"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createServerClient } from "@supabase/ssr";
import { createServerClient as createServiceClient } from "@/lib/supabase-server";
import { sendPushToProfiles } from "@/lib/push";
import { rememberVisitor } from "@/lib/visitantes";
import { randomInt, randomUUID } from "node:crypto";
import { QR_PREFIJO } from "@/lib/qr";
import {
  REQUEST_TIMEOUT_SECONDS,
  findActivePass,
  findPassByCodeOrToken,
  getPendingRequestsForResidents,
  getRequest,
  getResidentIdsForProfile,
  type AccessRequestRow,
  type VisitPassRow,
} from "@/lib/citofono";
import { normalizeRut } from "@/lib/rut";
import { appUrl } from "@/lib/app-url";
import { startOfDayUtc, todayInChile } from "@/lib/fecha";
import { addVehicle, cancelLoan, lendSpot, removeVehicle } from "@/lib/parking";
import type { Database } from "@/lib/database.types";

// ── Sesión ────────────────────────────────────────────────────────

async function getSessionUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

async function getCtx() {
  const user = await getSessionUser();
  if (!user) return null;

  const db = createServiceClient();
  const { data: profile } = await db
    .from("profiles")
    .select("organization_id, full_name, role")
    .eq("id", user.id)
    .single();

  if (!profile?.organization_id) return null;

  const { data: building } = await db
    .from("buildings")
    .select("id")
    .eq("organization_id", profile.organization_id)
    .limit(1)
    .maybeSingle();

  return {
    userId: user.id,
    name: profile.full_name ?? user.email ?? "Usuario",
    role: profile.role ?? "residente",
    buildingId: building?.id ?? null,
  };
}

// ── Lado conserje ─────────────────────────────────────────────────

export interface PassCheck {
  hasPass: boolean;
  passId?: string;
  authorizedBy?: string;
  validUntil?: string;
  note?: string;
  /** false cuando la unidad no tiene ningún residente con cuenta */
  canRequest: boolean;
}

/**
 * Antes de registrar: ¿este visitante ya viene autorizado por la unidad?
 * Responde también si tiene sentido ofrecer "pedir autorización".
 */
export async function checkPassForVisitor(input: {
  residentId: string;
  visitorName: string;
  visitorRut?: string;
}): Promise<PassCheck> {
  const ctx = await getCtx();
  if (!ctx?.buildingId) return { hasPass: false, canRequest: false };

  const db = createServiceClient();
  const { count } = await db
    .from("resident_members")
    .select("id", { count: "exact", head: true })
    .eq("resident_id", input.residentId);

  const canRequest = (count ?? 0) > 0;

  const pass = await findActivePass(
    ctx.buildingId,
    input.residentId,
    input.visitorName,
    input.visitorRut
  );
  if (!pass) return { hasPass: false, canRequest };

  return {
    hasPass: true,
    passId: pass.id,
    authorizedBy: pass.created_by_name ?? "la unidad",
    validUntil: pass.valid_until,
    note: pass.note ?? undefined,
    canRequest,
  };
}

/**
 * Crea la solicitud y despierta a la unidad. El conserje se queda
 * mirando esta solicitud hasta que la respondan o se venza.
 */
export async function createAccessRequest(input: {
  residentId: string;
  unitCode: string;
  visitorName: string;
  visitorRut?: string;
  plate?: string;
  kind?: "visita" | "delivery" | "proveedor";
}): Promise<{ ok: boolean; requestId?: string; expiresAt?: string; error?: string }> {
  const ctx = await getCtx();
  if (!ctx?.buildingId) return { ok: false, error: "No autenticado" };

  const db = createServiceClient();
  const expiresAt = new Date(Date.now() + REQUEST_TIMEOUT_SECONDS * 1000).toISOString();

  const { data, error } = await db
    .from("access_requests")
    .insert({
      building_id: ctx.buildingId,
      resident_id: input.residentId,
      unit_code: input.unitCode,
      visitor_name: input.visitorName,
      visitor_rut: input.visitorRut ?? null,
      plate: input.plate ?? null,
      kind: input.kind ?? "visita",
      requested_by: ctx.name,
      expires_at: expiresAt,
    })
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: error?.message ?? "No se pudo crear la solicitud" };

  // Avisar a todas las cuentas de esa unidad
  const { data: members } = await db
    .from("resident_members")
    .select("profile_id")
    .eq("resident_id", input.residentId);

  const profileIds = (members ?? []).map((m) => m.profile_id);
  await sendPushToProfiles(profileIds, {
    title: `${input.visitorName} está en portería`,
    body: `${input.unitCode} · pide autorización para subir. Toca para responder.`,
    url: "/residente",
    tag: `req-${data.id}`,
    requireInteraction: true,
  });

  return { ok: true, requestId: data.id, expiresAt };
}

/** Marca el pase como ocupado cuando el visitante efectivamente entró. */
export async function consumePass(passId: string): Promise<{ ok: boolean }> {
  const ctx = await getCtx();
  if (!ctx?.buildingId) return { ok: false };

  const db = createServiceClient();
  const { data: pass } = await db
    .from("visit_passes")
    .select("id, single_use, used_count, building_id")
    .eq("id", passId)
    .maybeSingle();

  if (!pass || pass.building_id !== ctx.buildingId) return { ok: false };

  await db
    .from("visit_passes")
    .update({
      used_at: new Date().toISOString(),
      used_count: (pass.used_count ?? 0) + 1,
      status: pass.single_use ? "usado" : "activo",
    })
    .eq("id", passId);

  return { ok: true };
}

/** El conserje consulta el estado mientras espera. */
export async function pollAccessRequest(
  requestId: string
): Promise<{ status: AccessRequestRow["status"]; respondedBy: string | null } | null> {
  const ctx = await getCtx();
  if (!ctx?.buildingId) return null;

  const req = await getRequest(requestId);
  if (!req || req.building_id !== ctx.buildingId) return null;

  // Vencerla en el momento que corresponde, no cuando alguien pase a mirar
  if (req.status === "pendiente" && new Date(req.expires_at).getTime() < Date.now()) {
    const db = createServiceClient();
    await db.from("access_requests").update({ status: "vencida" }).eq("id", requestId);
    return { status: "vencida", respondedBy: null };
  }

  return { status: req.status, respondedBy: req.responded_by_name };
}

/**
 * Registra el ingreso de una visita que la unidad ya autorizó. Todo el
 * trabajo pasa en el servidor para que sea una sola operación: escribe
 * la bitácora, deja el rastro de quién autorizó y cierra la solicitud.
 */
export async function registerApprovedRequest(
  requestId: string
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await getCtx();
  if (!ctx?.buildingId) return { ok: false, error: "No autenticado" };

  const req = await getRequest(requestId);
  if (!req || req.building_id !== ctx.buildingId) {
    return { ok: false, error: "La solicitud no existe" };
  }
  if (req.status !== "aprobada") {
    return { ok: false, error: "Esa visita ya no está autorizada" };
  }
  if (req.access_log_id) {
    return { ok: false, error: "El ingreso ya estaba registrado" };
  }

  const db = createServiceClient();
  const { data: row, error } = await db
    .from("access_log")
    .insert({
      building_id: ctx.buildingId,
      type: "in",
      who: req.visitor_name,
      context: req.kind === "visita" ? "Visita" : req.kind,
      unit: req.unit_code,
      plate: req.plate,
      rut: req.visitor_rut,
      recorded_by: ctx.name,
      request_id: req.id,
      authorized_by: `${req.responded_by_name ?? "La unidad"} · app`,
    })
    .select("id")
    .single();

  if (error || !row) return { ok: false, error: error?.message ?? "No se pudo registrar" };

  await db.from("access_requests").update({ access_log_id: row.id }).eq("id", req.id);

  if (req.visitor_rut) {
    try {
      await rememberVisitor({
        buildingId: ctx.buildingId,
        rut: req.visitor_rut,
        name: req.visitor_name,
        unit: req.unit_code,
      });
    } catch {
      /* el ingreso ya quedó registrado */
    }
  }

  return { ok: true };
}

/** Cancelar la espera (el visitante se fue, el conserje se arrepintió). */
export async function cancelAccessRequest(requestId: string): Promise<{ ok: boolean }> {
  const ctx = await getCtx();
  if (!ctx?.buildingId) return { ok: false };

  const db = createServiceClient();
  await db
    .from("access_requests")
    .update({ status: "vencida" })
    .eq("id", requestId)
    .eq("building_id", ctx.buildingId)
    .eq("status", "pendiente");

  return { ok: true };
}

// ── Lado residente ────────────────────────────────────────────────

export async function respondAccessRequest(
  requestId: string,
  decision: "aprobada" | "rechazada"
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await getCtx();
  if (!ctx) return { ok: false, error: "No autenticado" };

  const mine = await getResidentIdsForProfile(ctx.userId);
  const myResidentIds = mine.map((m) => m.residentId);

  const req = await getRequest(requestId);
  if (!req) return { ok: false, error: "La solicitud ya no existe" };

  // Solo responde quien vive en esa unidad
  if (!req.resident_id || !myResidentIds.includes(req.resident_id)) {
    return { ok: false, error: "Esta solicitud no es de tu unidad" };
  }
  if (req.status !== "pendiente") {
    return { ok: false, error: "Esta solicitud ya fue respondida" };
  }

  const db = createServiceClient();
  const { error } = await db
    .from("access_requests")
    .update({
      status: decision,
      responded_at: new Date().toISOString(),
      responded_by: ctx.userId,
      responded_by_name: ctx.name,
    })
    .eq("id", requestId)
    .eq("status", "pendiente");

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** La app del residente pregunta si tiene alguien esperando abajo. */
export async function getMyPendingRequests(): Promise<AccessRequestRow[]> {
  const ctx = await getCtx();
  if (!ctx) return [];
  const mine = await getResidentIdsForProfile(ctx.userId);
  return getPendingRequestsForResidents(mine.map((m) => m.residentId));
}

// ── Pases anticipados (los crea el residente) ────────────────────

export async function createVisitPass(input: {
  residentId: string;
  visitorName: string;
  visitorRut?: string;
  plate?: string;
  note?: string;
  /** Horas de vigencia desde ahora. Por defecto, hasta el fin del día. */
  hours?: number;
  singleUse?: boolean;
}): Promise<{ ok: boolean; pass?: VisitPassRow; error?: string }> {
  const ctx = await getCtx();
  if (!ctx) return { ok: false, error: "No autenticado" };

  const mine = await getResidentIdsForProfile(ctx.userId);
  if (!mine.some((m) => m.residentId === input.residentId)) {
    return { ok: false, error: "No puedes crear pases para otra unidad" };
  }
  if (!input.visitorName.trim()) {
    return { ok: false, error: "Falta el nombre de la visita" };
  }
  // El pase se valida contra el documento que la persona presenta en
  // portería: sin RUT no hay forma de confirmar que es quien dices.
  if (normalizeRut(input.visitorRut ?? "").length < 7) {
    return { ok: false, error: "Necesitas el RUT de tu visita para dejar el pase" };
  }

  const validUntil = input.hours
    ? new Date(Date.now() + input.hours * 3600 * 1000)
    : endOfToday();

  const db = createServiceClient();
  const { data: building } = await db
    .from("residents")
    .select("building_id")
    .eq("id", input.residentId)
    .single();

  // El pase se presenta de tres formas: RUT, QR y código dictado. El token
  // es opaco y el código son seis dígitos, únicos entre los pases vigentes
  // del edificio — de ahí el reintento si dos residentes sacan el mismo.
  const base = {
    building_id: building!.building_id,
    resident_id: input.residentId,
    created_by: ctx.userId,
    created_by_name: ctx.name,
    visitor_name: input.visitorName.trim(),
    // El RUT se guarda normalizado: es la llave con la que el conserje
    // va a encontrar este pase cuando la persona llegue.
    visitor_rut: input.visitorRut?.trim() ? normalizeRut(input.visitorRut) : null,
    plate: input.plate?.trim() || null,
    note: input.note?.trim() || null,
    valid_until: validUntil.toISOString(),
    single_use: input.singleUse ?? true,
    token: randomUUID().replace(/-/g, ""),
  };

  for (let intento = 0; intento < 5; intento++) {
    const { data: pass, error } = await db
      .from("visit_passes")
      .insert({ ...base, code: String(randomInt(100_000, 1_000_000)) })
      .select()
      .single();

    if (!error && pass) return { ok: true, pass: pass as VisitPassRow };
    // 23505: el código ya está tomado por otro pase vigente. Se sortea otro.
    if (error?.code !== "23505") {
      return { ok: false, error: error?.message ?? "No se pudo guardar el pase" };
    }
  }

  return { ok: false, error: "No se pudo generar un código libre. Intenta de nuevo." };
}

function endOfToday() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

export async function revokeVisitPass(passId: string): Promise<{ ok: boolean; error?: string }> {
  const ctx = await getCtx();
  if (!ctx) return { ok: false, error: "No autenticado" };

  const mine = await getResidentIdsForProfile(ctx.userId);
  const db = createServiceClient();

  const { data: pass } = await db
    .from("visit_passes")
    .select("resident_id")
    .eq("id", passId)
    .maybeSingle();

  if (!pass || !mine.some((m) => m.residentId === pass.resident_id)) {
    return { ok: false, error: "Ese pase no es de tu unidad" };
  }

  await db.from("visit_passes").update({ status: "revocado" }).eq("id", passId);
  return { ok: true };
}

// ── Push ──────────────────────────────────────────────────────────

export async function savePushSubscription(input: {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const ctx = await getCtx();
  if (!ctx) return { ok: false, error: "No autenticado" };

  const db = createServiceClient();
  const { error } = await db
    .from("push_subscriptions")
    .upsert(
      {
        profile_id: ctx.userId,
        endpoint: input.endpoint,
        p256dh: input.p256dh,
        auth: input.auth,
        user_agent: input.userAgent ?? null,
      },
      { onConflict: "endpoint" }
    );

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function sendTestPush(): Promise<{ ok: boolean; sent: number }> {
  const ctx = await getCtx();
  if (!ctx) return { ok: false, sent: 0 };
  const res = await sendPushToProfiles([ctx.userId], {
    title: "Portex está listo",
    body: "Vas a recibir las autorizaciones de visita acá.",
    url: "/residente",
    tag: "test",
  });
  return { ok: true, sent: res.sent };
}

// ── Invitación de residentes al portal (la usa el admin) ─────────

export async function inviteResidentToPortal(input: {
  residentId: string;
  email: string;
}): Promise<{ ok: boolean; error?: string }> {
  const ctx = await getCtx();
  if (!ctx || ctx.role !== "admin") {
    return { ok: false, error: "Solo el administrador puede invitar residentes" };
  }
  if (!ctx.buildingId) return { ok: false, error: "Edificio no encontrado" };

  const db = createServiceClient();

  const { data: resident } = await db
    .from("residents")
    .select("id, name, unit_code, building_id")
    .eq("id", input.residentId)
    .eq("building_id", ctx.buildingId)
    .maybeSingle();

  if (!resident) return { ok: false, error: "Ese residente no es de tu edificio" };

  const { data: profile } = await db
    .from("profiles")
    .select("organization_id")
    .eq("id", ctx.userId)
    .single();

  const { data: invited, error } = await db.auth.admin.inviteUserByEmail(input.email, {
    data: {
      role: "residente",
      organization_id: profile!.organization_id,
      full_name: resident.name,
      resident_id: resident.id,
    },
    redirectTo: `${appUrl()}/auth/callback?next=/update-password`,
  });

  if (error) {
    // Si ya tenía cuenta, igual lo vinculamos a la unidad
    if (error.message.toLowerCase().includes("already been registered")) {
      const { data: existing } = await db
        .from("profiles")
        .select("id")
        .eq("full_name", resident.name)
        .maybeSingle();
      if (existing) {
        await linkResidentMember(resident.id, existing.id, resident.building_id);
        return { ok: true };
      }
    }
    return { ok: false, error: error.message };
  }

  if (invited?.user?.id) {
    await linkResidentMember(resident.id, invited.user.id, resident.building_id);
  }

  return { ok: true };
}

async function linkResidentMember(residentId: string, profileId: string, buildingId: string) {
  const db = createServiceClient();
  await db
    .from("resident_members")
    .upsert(
      { resident_id: residentId, profile_id: profileId, building_id: buildingId },
      { onConflict: "resident_id,profile_id" }
    );
}

// ── Estacionamiento y autos del residente ─────────────────────────
//
// Todas estas acciones parten por preguntar a qué departamentos pertenece
// la sesión. El id del estacionamiento o del auto viaja desde el navegador,
// así que nunca alcanza para autorizar: lo que autoriza es el vínculo entre
// el perfil y la unidad, que vive en la base.

/** Los departamentos de la sesión, o null si no hay sesión de residente. */
async function getMisUnidades() {
  const ctx = await getCtx();
  if (!ctx?.buildingId) return null;

  const units = await getResidentIdsForProfile(ctx.userId);
  if (units.length === 0) return null;

  return {
    buildingId: ctx.buildingId,
    profileId: ctx.userId,
    residentIds: units.map((u) => u.residentId),
    unitCodes: units.map((u) => u.unitCode),
  };
}

/**
 * Presta el estacionamiento hasta el final del día indicado.
 *
 * La fecha llega como "YYYY-MM-DD" desde un input date: se guarda el último
 * instante de ese día en hora de Chile, que es lo que el residente entiende
 * por "hasta el domingo".
 */
export async function lendMyParkingSpot(
  spotId: string,
  untilDate: string
): Promise<{ ok: boolean; error?: string }> {
  const mias = await getMisUnidades();
  if (!mias) return { ok: false, error: "Tu cuenta no está ligada a un departamento" };

  if (!/^\d{4}-\d{2}-\d{2}$/.test(untilDate)) {
    return { ok: false, error: "Fecha inválida" };
  }
  if (untilDate < todayInChile()) {
    return { ok: false, error: "Esa fecha ya pasó" };
  }

  const finDelDia = startOfDayUtc(untilDate);
  const until = new Date(new Date(finDelDia).getTime() + 86_400_000 - 1).toISOString();

  const res = await lendSpot(mias.buildingId, spotId, mias.unitCodes, until, mias.profileId);
  if (res.ok) revalidatePath("/residente");
  return res;
}

export async function cancelMyParkingLoan(
  spotId: string
): Promise<{ ok: boolean; error?: string }> {
  const mias = await getMisUnidades();
  if (!mias) return { ok: false, error: "Tu cuenta no está ligada a un departamento" };

  const res = await cancelLoan(mias.buildingId, spotId, mias.unitCodes);
  if (res.ok) revalidatePath("/residente");
  return res;
}

export async function addMyVehicle(input: {
  residentId: string;
  plate: string;
  model?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const mias = await getMisUnidades();
  if (!mias) return { ok: false, error: "Tu cuenta no está ligada a un departamento" };
  if (!mias.residentIds.includes(input.residentId)) {
    return { ok: false, error: "Ese departamento no es tuyo" };
  }

  const res = await addVehicle(
    mias.buildingId,
    input.residentId,
    input.plate,
    input.model ?? null,
    mias.profileId
  );
  if (res.ok) revalidatePath("/residente");
  return res;
}

export async function removeMyVehicle(
  vehicleId: string
): Promise<{ ok: boolean; error?: string }> {
  const mias = await getMisUnidades();
  if (!mias) return { ok: false, error: "Tu cuenta no está ligada a un departamento" };

  const res = await removeVehicle(mias.buildingId, vehicleId, mias.residentIds);
  if (res.ok) revalidatePath("/residente");
  return res;
}


// ── Pase por QR o código (lado conserje) ─────────────────────────
//
// El residente deja el pase y su visita llega con el QR en el teléfono. El
// conserje lo escanea, o le pregunta los seis dígitos si la cámara no da.
// De ahí en adelante es un toque: la unidad ya autorizó.

export interface PassLookup {
  ok: boolean;
  error?: string;
  passId?: string;
  visitorName?: string;
  visitorRut?: string | null;
  plate?: string | null;
  note?: string | null;
  unitCode?: string;
  residentName?: string;
  authorizedBy?: string | null;
  validUntil?: string;
}

/** ¿Qué pase es este QR o este código? */
export async function lookupPass(entrada: string): Promise<PassLookup> {
  const ctx = await getCtx();
  if (!ctx?.buildingId) return { ok: false, error: "Sesión expirada" };
  if (ctx.role !== "conserje" && ctx.role !== "admin") {
    return { ok: false, error: "Solo la portería puede validar pases" };
  }

  const found = await findPassByCodeOrToken(ctx.buildingId, entrada);
  if (!found) {
    return {
      ok: false,
      error: entrada.trim().toUpperCase().startsWith(QR_PREFIJO)
        ? "Ese QR no corresponde a un pase vigente de este edificio."
        : "No hay ningún pase vigente con ese código.",
    };
  }

  return {
    ok: true,
    passId: found.pass.id,
    visitorName: found.pass.visitor_name,
    visitorRut: found.pass.visitor_rut,
    plate: found.pass.plate,
    note: found.pass.note,
    unitCode: found.unitCode,
    residentName: found.residentName,
    authorizedBy: found.pass.created_by_name,
    validUntil: found.pass.valid_until,
  };
}

/**
 * Registra el ingreso de un pase escaneado. Va entero en el servidor para
 * que sea una sola operación: bitácora, rastro de quién autorizó, pase
 * consumido y padrón de recurrentes al día.
 */
export async function registerPassEntry(
  passId: string
): Promise<{ ok: boolean; error?: string; visitorName?: string; unitCode?: string | null }> {
  const ctx = await getCtx();
  if (!ctx?.buildingId) return { ok: false, error: "Sesión expirada" };
  if (ctx.role !== "conserje" && ctx.role !== "admin") {
    return { ok: false, error: "Solo la portería puede registrar ingresos" };
  }

  const db = createServiceClient();
  const { data } = await db
    .from("visit_passes")
    .select("*, residents!inner(id, unit_code, name)")
    .eq("id", passId)
    .eq("building_id", ctx.buildingId)
    .maybeSingle();

  if (!data) return { ok: false, error: "Ese pase no es de este edificio" };

  const pass = data as unknown as VisitPassRow & {
    residents: { id: string; unit_code: string; name: string };
  };

  if (pass.status !== "activo") return { ok: false, error: "Ese pase ya fue usado o anulado" };
  if (new Date(pass.valid_until).getTime() < Date.now()) {
    return { ok: false, error: "Ese pase ya venció" };
  }

  const { data: row, error } = await db
    .from("access_log")
    .insert({
      building_id: ctx.buildingId,
      type: "in",
      who: pass.visitor_name,
      context: "Visita",
      unit: pass.residents.unit_code,
      plate: pass.plate,
      rut: pass.visitor_rut,
      recorded_by: ctx.name,
      authorized_by: `Pase previo · ${pass.created_by_name ?? "la unidad"}`,
    })
    .select("id")
    .single();

  if (error || !row) return { ok: false, error: error?.message ?? "No se pudo registrar" };

  await db
    .from("visit_passes")
    .update({
      used_at: new Date().toISOString(),
      used_count: (pass.used_count ?? 0) + 1,
      status: pass.single_use ? "usado" : "activo",
    })
    .eq("id", pass.id);

  if (pass.visitor_rut) {
    try {
      await rememberVisitor({
        buildingId: ctx.buildingId,
        rut: pass.visitor_rut,
        name: pass.visitor_name,
        unit: pass.residents.unit_code,
      });
    } catch {
      /* el ingreso ya quedó registrado */
    }
  }

  revalidatePath("/conserje");
  return { ok: true, visitorName: pass.visitor_name, unitCode: pass.residents.unit_code };
}

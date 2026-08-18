"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createServerClient } from "@supabase/ssr";
import { insertAccessLog } from "@/lib/db";
import { rememberVisitor, findVisitorByRut, type KnownVisitor } from "@/lib/visitantes";
import { findActivePassByRut } from "@/lib/citofono";
import { normalizeRut } from "@/lib/rut";
import {
  findVehicleByPlate,
  getAvailability,
  getSpots,
  occupySpot,
  releaseByPlate,
  releaseSession,
} from "@/lib/parking";
import type { ParkingAvailability } from "@/lib/parking-types";
import { appUrl } from "@/lib/app-url";
import { startOfTodayUtc, todayInChile } from "@/lib/fecha";
import { NOTICE_LABEL, notifyBuilding, notifyUnit, type NoticeKind } from "@/lib/avisos";
import { marcarAvisada, registrarEncomienda } from "@/lib/encomiendas";
import {
  abrirJornada,
  cerrarJornada,
  findStaffByName,
  getOpenAttendance,
} from "@/lib/asistencia";
import { createServerClient as createServiceClient } from "@/lib/supabase-server";
import type { AccessType, Database, ParkingKind } from "@/lib/database.types";

// ── Shared helpers ───────────────────────────────────────────────

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

async function getSessionContext() {
  const user = await getSessionUser();
  if (!user) return null;

  const db = createServiceClient();

  const { data: profile } = await db
    .from("profiles")
    .select("organization_id, full_name, role")
    .eq("id", user.id)
    .single();

  if (!profile?.organization_id) {
    return {
      user,
      staffName: profile?.full_name ?? "Conserje",
      role: profile?.role ?? "conserje",
      organizationId: null,
      buildingId: null,
    };
  }

  const { data: building } = await db
    .from("buildings")
    .select("id")
    .eq("organization_id", profile.organization_id)
    .limit(1)
    .maybeSingle();

  return {
    user,
    staffName: profile.full_name ?? "Conserje",
    role: profile.role ?? "conserje",
    organizationId: profile.organization_id,
    buildingId: building?.id ?? null,
  };
}

/**
 * Contexto de sesión que además exige rol admin y edificio resuelto.
 * Devuelve null si el usuario no es admin — las acciones que lo usan
 * deben cortar ahí: son escrituras que un conserje no puede hacer.
 */
async function getAdminContext() {
  const ctx = await getSessionContext();
  if (!ctx || ctx.role !== "admin") return null;
  return ctx;
}

const NO_ADMIN = "Solo el administrador puede hacer esto";

// ── Access log ───────────────────────────────────────────────────

export interface RegisterEntryInput {
  type: AccessType;
  who: string;
  context?: string;
  unit?: string;
  plate?: string;
  /** Solicitud que respaldó este ingreso, si pasó por el citófono. */
  requestId?: string;
  /** "Carla Mena · app", "Pase previo · Carla Mena", "Sin respuesta de la unidad". */
  authorizedBy?: string;
  /** La identidad del visitante. Con esto el sistema lo reconoce la próxima vez. */
  rut?: string;
  /** "Visita", "Servicio", "Delivery"… queda en el padrón de recurrentes. */
  reason?: string;
  /** Estacionamiento que el conserje aceptó darle a este auto. */
  parkingSpotId?: string;
  /**
   * El trabajo que viene a hacer un proveedor. Es lo que separa "llegó VTR
   * al 1204" de "cortan el agua de todo el edificio": lo segundo le importa
   * a las 312 unidades y hasta ahora no se enteraba nadie.
   */
  servicio?: {
    kind: NoticeKind;
    scope: "edificio" | "unidad";
    /** Cuánto va a durar, en horas. Sin esto el aviso no tiene término. */
    horas?: number;
  };
}

export interface RegisterEntryResult {
  ok: true;
  id: string;
  recorded_at: string;
  who: string;
  unit: string | null;
  plate: string | null;
  recorded_by: string | null;
  /**
   * Qué pasó con el estacionamiento. Se informa por separado porque el ingreso
   * ya quedó registrado igual: si el lugar se ocupó entremedio, el conserje
   * tiene que enterarse, pero la persona no se queda sin entrar por eso.
   */
  parking?: { assigned: boolean; code?: string; error?: string };
  /**
   * La encomienda que quedó guardada. **Sin el código a propósito**: si el
   * conserje lo viera, verificarlo no probaría nada — podría dictárselo él
   * mismo a quien pase. El código vive en el teléfono del departamento; la
   * portería solo comprueba que quien viene lo trae.
   */
  parcel?: { id: string };
  /** Si al departamento le sonó el teléfono, y en cuántos aparatos. */
  avisados?: number;
  /** El aviso que quedó publicado por el trabajo de un proveedor. */
  aviso?: { id: string; scope: "edificio" | "unidad" };
}

export async function registerEntry(
  input: RegisterEntryInput
): Promise<RegisterEntryResult> {
  const ctx = await getSessionContext();
  if (!ctx?.buildingId) throw new Error("Edificio no encontrado");

  const rut = input.rut ? normalizeRut(input.rut) : undefined;

  const row = await insertAccessLog({
    building_id: ctx.buildingId,
    type: input.type,
    who: input.who,
    context: input.context,
    unit: input.unit,
    plate: input.plate,
    recorded_by: ctx.staffName,
    request_id: input.requestId,
    authorized_by: input.authorizedBy,
    rut,
  });

  // El sistema aprende de cada ingreso: la próxima vez basta el RUT.
  if (rut) {
    try {
      await rememberVisitor({
        buildingId: ctx.buildingId,
        rut,
        name: input.who,
        unit: input.unit ?? null,
        reason: input.reason ?? null,
      });
    } catch {
      /* el ingreso ya quedó registrado; el padrón se pone al día en la próxima */
    }
  }

  // Cerrar el círculo: la solicitud queda apuntando al ingreso real,
  // así el administrador puede reconstruir el caso completo.
  if (input.requestId) {
    const db = createServiceClient();
    await db
      .from("access_requests")
      .update({ access_log_id: row.id })
      .eq("id", input.requestId)
      .eq("building_id", ctx.buildingId);
  }

  // ── Estacionamiento ──────────────────────────────────────────
  let parking: RegisterEntryResult["parking"];

  if (input.parkingSpotId && input.plate) {
    const spots = await getSpots(ctx.buildingId);
    const spot = spots.find((s) => s.id === input.parkingSpotId);
    const result = await occupySpot({
      buildingId: ctx.buildingId,
      spotId: input.parkingSpotId,
      plate: input.plate,
      driverName: input.who,
      rut,
      unitCode: input.unit ?? null,
      accessLogId: row.id,
      createdBy: ctx.staffName,
    });
    parking = result.ok
      ? { assigned: true, code: spot?.code }
      : { assigned: false, error: result.error };
  }

  // El auto se va, el lugar queda libre. Si no tenía estacionamiento asignado
  // esto no hace nada: la mayoría de la gente entra caminando.
  if (input.type === "out" && input.plate) {
    try {
      const released = await releaseByPlate(ctx.buildingId, input.plate, ctx.staffName);
      if (released) parking = { assigned: false };
    } catch {
      /* la salida ya quedó registrada; el estacionamiento se libera a mano */
    }
  }

  // ── Lo que le llegó al departamento ──────────────────────────
  //
  // Acá se cierra el "bajo a preguntar si llegó algo": el paquete queda
  // guardado con su código de retiro y al departamento le suena el teléfono.
  // Ninguna de las dos cosas puede voltear el ingreso, que ya está escrito.
  let parcel: RegisterEntryResult["parcel"];
  let avisados: number | undefined;

  if (input.type === "parcel" && input.unit) {
    try {
      const { data: resident } = await createServiceClient()
        .from("residents")
        .select("id")
        .eq("building_id", ctx.buildingId)
        .eq("unit_code", input.unit)
        .limit(1)
        .maybeSingle();

      const res = await registrarEncomienda({
        buildingId: ctx.buildingId,
        unitCode: input.unit,
        residentId: resident?.id ?? null,
        courier: input.who,
        description: input.context ?? null,
        receivedBy: ctx.staffName,
        accessLogId: row.id,
      });

      if (res.ok && res.parcel) {
        parcel = { id: res.parcel.id };
        avisados = await notifyUnit(ctx.buildingId, input.unit, {
          title: `Llegó una encomienda · ${input.who}`,
          body: `Está en portería. Para retirarla, el código es ${res.parcel.code}.`,
          url: "/residente",
          tag: `parcel-${res.parcel.id}`,
        });
        if (avisados > 0) await marcarAvisada(res.parcel.id);
      }
    } catch {
      /* el paquete quedó en la bitácora aunque falle el aviso */
    }
  }

  // La pizza no se guarda ni tiene código: el residente baja a buscarla.
  // Lo único que faltaba era enterarse de que llegó.
  if (input.type === "delivery" && input.unit) {
    try {
      avisados = await notifyUnit(ctx.buildingId, input.unit, {
        title: `Tu pedido está en portería`,
        body: `${input.who} acaba de dejarlo abajo.`,
        url: "/residente",
        tag: `delivery-${row.id}`,
      });
    } catch {
      /* idem */
    }
  }

  // ── El trabajo que viene a hacer ─────────────────────────────
  //
  // El proveedor no solo entra: viene a hacer algo que le cambia el día a
  // alguien. Queda publicado como aviso —con hasta cuándo dura— y se le
  // manda a quien le toca.
  let aviso: RegisterEntryResult["aviso"];

  if (input.servicio) {
    try {
      const db = createServiceClient();
      const inicio = new Date();
      const fin = input.servicio.horas
        ? new Date(inicio.getTime() + input.servicio.horas * 3_600_000)
        : null;

      const { data: noticeRow } = await db
        .from("notices")
        .insert({
          building_id: ctx.buildingId,
          kind: input.servicio.kind,
          title: input.who,
          body: input.context ?? null,
          scope: input.servicio.scope,
          unit_code: input.servicio.scope === "unidad" ? (input.unit ?? null) : null,
          starts_at: inicio.toISOString(),
          ends_at: fin?.toISOString() ?? null,
          source: "porteria",
          access_log_id: row.id,
          created_by_name: ctx.staffName,
        })
        .select("id")
        .single();

      const hasta = fin
        ? ` hasta las ${fin.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Santiago" })}`
        : "";
      const payload = {
        title: `${NOTICE_LABEL[input.servicio.kind]} · ${input.who}`,
        body:
          input.servicio.scope === "edificio"
            ? `Está trabajando en el edificio${hasta}.${input.context ? ` ${input.context}` : ""}`
            : `Llegó a tu departamento${hasta}.${input.context ? ` ${input.context}` : ""}`,
        url: "/residente",
        tag: `notice-${noticeRow?.id ?? row.id}`,
      };

      avisados =
        input.servicio.scope === "edificio"
          ? await notifyBuilding(ctx.buildingId, payload)
          : input.unit
          ? await notifyUnit(ctx.buildingId, input.unit, payload)
          : 0;

      if (noticeRow?.id) {
        aviso = { id: noticeRow.id, scope: input.servicio.scope };
        if (avisados > 0) {
          await db
            .from("notices")
            .update({ notified_at: new Date().toISOString() })
            .eq("id", noticeRow.id);
        }
      }
    } catch {
      /* el ingreso del proveedor ya quedó registrado */
    }
  }

  return {
    ok: true,
    id: row.id,
    recorded_at: row.recorded_at,
    who: row.who,
    unit: row.unit,
    plate: row.plate,
    recorded_by: row.recorded_by,
    parking,
    parcel,
    avisados,
    aviso,
  };
}

/**
 * ¿De quién es este auto?
 *
 * La portería lo pregunta al tipear una patente. Si es de un residente, el
 * conserje se entera antes de registrarlo como visita — y sabe a qué puerta
 * tocar cuando el auto está mal estacionado.
 */
export async function lookupPlate(plate: string): Promise<{
  plate: string;
  model: string | null;
  unitCode: string;
  residentName: string;
} | null> {
  const ctx = await getSessionContext();
  if (!ctx?.buildingId) return null;
  return findVehicleByPlate(ctx.buildingId, plate);
}

/**
 * Qué estacionamiento ofrecerle a una visita que va a cierta unidad.
 * Lo consulta el drawer de portería en cuanto sabe patente y depto.
 */
export async function getParkingForUnit(
  unitCode?: string | null
): Promise<ParkingAvailability | null> {
  const ctx = await getSessionContext();
  if (!ctx?.buildingId) return null;
  const availability = await getAvailability(ctx.buildingId, unitCode);

  // Edificio sin estacionamientos cargados: el módulo no aplica y la portería
  // no muestra nada. Ojo con la condición: un cupo prestado por un vecino es
  // razón suficiente para hablar, aunque el depto no tenga estacionamiento
  // propio y no queden cupos de visita.
  const noHayNadaQueDecir =
    !availability.suggestion &&
    !availability.unitSpot &&
    availability.totalVisitorSpots === 0;

  return noHayNadaQueDecir ? null : availability;
}

export interface RutLookupResult {
  found: boolean;
  visitor?: KnownVisitor;
  /** Residente de la unidad a la que suele ir, para saltarse la búsqueda. */
  residentId?: string;
  residentName?: string;
  /** La unidad ya la anunció: entra sin esperar autorización. */
  pass?: {
    id: string;
    visitorName: string;
    authorizedBy: string;
    unitCode: string;
    residentId: string;
    residentName: string;
    validUntil: string;
    note: string | null;
  };
}

/**
 * "Buenos días, su RUT por favor" — 26.011.410-7.
 * Si el sistema ya lo conoce devuelve nombre y a quién visita, y el
 * conserje solo confirma. Es el atajo que hace el registro de 7 segundos.
 */
export async function lookupVisitorByRut(rut: string): Promise<RutLookupResult> {
  const ctx = await getSessionContext();
  if (!ctx?.buildingId) return { found: false };

  // Un pase vigente resuelve la visita completa con solo el RUT.
  const passHit = await findActivePassByRut(ctx.buildingId, rut);
  const pass = passHit
    ? {
        id: passHit.pass.id,
        visitorName: passHit.pass.visitor_name,
        authorizedBy: passHit.pass.created_by_name ?? passHit.residentName,
        unitCode: passHit.unitCode,
        residentId: passHit.residentId,
        residentName: passHit.residentName,
        validUntil: passHit.pass.valid_until,
        note: passHit.pass.note,
      }
    : undefined;

  const visitor = await findVisitorByRut(ctx.buildingId, rut);

  if (!visitor) {
    // Primera vez que viene, pero la unidad lo estaba esperando.
    return pass ? { found: true, pass } : { found: false };
  }

  if (!visitor.unit) return { found: true, visitor, pass };

  const db = createServiceClient();
  const { data: resident } = await db
    .from("residents")
    .select("id, name")
    .eq("building_id", ctx.buildingId)
    .eq("unit_code", visitor.unit)
    .maybeSingle();

  return {
    found: true,
    visitor,
    residentId: resident?.id,
    residentName: resident?.name,
    pass,
  };
}

// ── Residents ────────────────────────────────────────────────────

export async function addResident(input: {
  unitCode: string;
  name: string;
  household?: string;
  rut?: string;
  contact?: string;
  status?: "activo" | "pendiente" | "inactivo";
}): Promise<{ ok: boolean; error?: string }> {
  const ctx = await getAdminContext();
  if (!ctx) return { ok: false, error: NO_ADMIN };
  if (!ctx.buildingId) return { ok: false, error: "Edificio no encontrado" };

  const db = createServiceClient();
  const { error } = await db.from("residents").insert({
    building_id: ctx.buildingId,
    unit_code: input.unitCode,
    name: input.name,
    household: input.household ?? null,
    rut: input.rut ?? null,
    contact: input.contact ?? null,
    status: input.status ?? "activo",
    tags: [],
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ── Estacionamientos ─────────────────────────────────────────────

/**
 * Da de alta un estacionamiento. Solo el administrador: la nómina de
 * estacionamientos es parte de la configuración del edificio, no algo que se
 * improvise en portería a las tres de la mañana.
 */
export async function addParkingSpot(input: {
  code: string;
  kind: ParkingKind;
  unitCode?: string;
  notes?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const ctx = await getAdminContext();
  if (!ctx) return { ok: false, error: NO_ADMIN };
  if (!ctx.buildingId) return { ok: false, error: "Edificio no encontrado" };

  const code = input.code.trim().toUpperCase();
  if (!code) return { ok: false, error: "Falta el número o código" };

  const unitCode = input.kind === "residente" ? input.unitCode?.trim().toUpperCase() : null;
  if (input.kind === "residente" && !unitCode) {
    return { ok: false, error: "Un estacionamiento de residente necesita su departamento" };
  }

  const db = createServiceClient();
  const { error } = await db.from("parking_spots").insert({
    building_id: ctx.buildingId,
    code,
    kind: input.kind,
    unit_code: unitCode,
    notes: input.notes?.trim() || null,
  });

  if (error) {
    if (error.code === "23505") return { ok: false, error: `Ya existe el estacionamiento ${code}` };
    return { ok: false, error: error.message };
  }
  revalidatePath("/admin/estacionamientos");
  return { ok: true };
}

/** Sacar de circulación un estacionamiento (obra, pintura, se vendió). */
export async function setParkingSpotActive(
  spotId: string,
  active: boolean
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await getAdminContext();
  if (!ctx?.buildingId) return { ok: false, error: NO_ADMIN };

  const db = createServiceClient();
  const { error } = await db
    .from("parking_spots")
    .update({ active })
    .eq("id", spotId)
    .eq("building_id", ctx.buildingId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/estacionamientos");
  return { ok: true };
}

/**
 * Liberar a mano. Pasa seguido: el auto se fue por el portón sin que nadie
 * marcara la salida, y el lugar queda ocupado en el sistema para siempre.
 */
export async function freeParkingSession(
  sessionId: string
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await getAdminContext();
  if (!ctx?.buildingId) return { ok: false, error: NO_ADMIN };

  try {
    await releaseSession(ctx.buildingId, sessionId, ctx.staffName);
  } catch {
    return { ok: false, error: "No se pudo liberar el estacionamiento" };
  }
  revalidatePath("/admin/estacionamientos");
  return { ok: true };
}

export async function updateResident(
  id: string,
  input: {
    unitCode: string;
    name: string;
    household?: string;
    rut?: string;
    contact?: string;
    status: "activo" | "pendiente" | "inactivo";
    tipo?: "Propietario" | "Arrendatario" | "";
  }
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await getAdminContext();
  if (!ctx) return { ok: false, error: "Solo el administrador puede editar residentes" };
  if (!ctx.buildingId) return { ok: false, error: "Edificio no encontrado" };

  const tags: string[] = [];
  if (input.tipo === "Propietario" || input.tipo === "Arrendatario") tags.push(input.tipo);

  const db = createServiceClient();
  const { error } = await db
    .from("residents")
    .update({
      unit_code: input.unitCode.trim().toUpperCase(),
      name: input.name.trim(),
      household: input.household?.trim() || null,
      rut: input.rut?.trim() || null,
      contact: input.contact?.trim() || null,
      status: input.status,
      tags,
    })
    .eq("id", id)
    .eq("building_id", ctx.buildingId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ── Frequent visitors ─────────────────────────────────────────────

export async function addFrequentVisitor(input: {
  name: string;
  rut?: string;
  reason?: string;
  defaultUnit?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const ctx = await getAdminContext();
  if (!ctx) return { ok: false, error: NO_ADMIN };
  if (!ctx.buildingId) return { ok: false, error: "Edificio no encontrado" };

  // Sin documento el visitante no se puede reconocer en portería, que es
  // justamente para lo que sirve tenerlo en la lista.
  const rut = normalizeRut(input.rut ?? "");
  if (rut.length < 7) {
    return { ok: false, error: "El RUT es obligatorio: es lo que identifica a la persona en portería" };
  }

  const db = createServiceClient();
  const { error } = await db.from("frequent_visitors").insert({
    building_id: ctx.buildingId,
    name: input.name,
    rut,
    reason: input.reason ?? null,
    default_unit: input.defaultUnit ?? null,
    last_unit: input.defaultUnit ?? null,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ── Staff ─────────────────────────────────────────────────────────

export async function addStaffMember(input: {
  name: string;
  rut?: string;
  role?: string;
  contact?: string;
  email?: string;
}): Promise<{ ok: boolean; invited?: boolean; error?: string }> {
  const ctx = await getAdminContext();
  if (!ctx) return { ok: false, error: NO_ADMIN };
  if (!ctx.buildingId) return { ok: false, error: "Edificio no encontrado" };

  const db = createServiceClient();
  const { error } = await db.from("staff").insert({
    building_id: ctx.buildingId,
    name: input.name,
    rut: input.rut ?? null,
    role: input.role ?? "Conserje",
    contact: input.contact ?? null,
    active: true,
  });

  if (error) return { ok: false, error: error.message };

  // If email provided, also send auth invite so they can log in
  if (input.email) {
    if (ctx.organizationId) {
      const { error: inviteErr } = await db.auth.admin.inviteUserByEmail(input.email, {
        data: {
          role: "conserje",
          organization_id: ctx.organizationId,
          full_name: input.name,
        },
        redirectTo: `${appUrl()}/auth/callback?next=/update-password`,
      });
      if (inviteErr) {
        return { ok: true, invited: false, error: `Personal agregado, pero error al invitar: ${inviteErr.message}` };
      }
      return { ok: true, invited: true };
    }
  }

  return { ok: true, invited: false };
}

export async function updateStaffMember(
  id: string,
  input: {
    name: string;
    rut?: string;
    role?: string;
    contact?: string;
  }
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await getAdminContext();
  if (!ctx) return { ok: false, error: NO_ADMIN };
  if (!ctx.buildingId) return { ok: false, error: "Edificio no encontrado" };

  const db = createServiceClient();
  const { error } = await db
    .from("staff")
    .update({
      name: input.name,
      rut: input.rut ?? null,
      role: input.role ?? "Conserje",
      contact: input.contact ?? null,
    })
    .eq("id", id)
    .eq("building_id", ctx.buildingId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deactivateStaffMember(id: string): Promise<{ ok: boolean; error?: string }> {
  const ctx = await getAdminContext();
  if (!ctx) return { ok: false, error: NO_ADMIN };
  if (!ctx.buildingId) return { ok: false, error: "Edificio no encontrado" };

  const db = createServiceClient();
  const { error } = await db
    .from("staff")
    .update({ active: false })
    .eq("id", id)
    .eq("building_id", ctx.buildingId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ── Shifts ────────────────────────────────────────────────────────

export async function addShift(input: {
  staffId: string;
  date: string;
  type: "mañana" | "tarde" | "noche";
  startTime: string;
  endTime: string;
  location?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const ctx = await getAdminContext();
  if (!ctx) return { ok: false, error: NO_ADMIN };
  if (!ctx.buildingId) return { ok: false, error: "Edificio no encontrado" };

  const db = createServiceClient();
  const { error } = await db.from("shifts").insert({
    building_id: ctx.buildingId,
    staff_id: input.staffId,
    date: input.date,
    type: input.type,
    start_time: input.startTime,
    end_time: input.endTime,
    location: input.location ?? null,
    status: "programado",
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ── Residents bulk import ─────────────────────────────────────────

export async function importResidents(
  rows: Array<{
    unitCode: string;
    name: string;
    tipo?: string;
    household?: string;
    rut?: string;
    contact?: string;
    status?: string;
  }>
): Promise<{ ok: boolean; inserted: number; error?: string }> {
  const ctx = await getAdminContext();
  if (!ctx) return { ok: false, inserted: 0, error: NO_ADMIN };
  if (!ctx.buildingId) return { ok: false, inserted: 0, error: "Edificio no encontrado" };

  const db = createServiceClient();
  const validStatuses = ["activo", "pendiente", "inactivo"];

  const records = rows.map((r) => {
    const tags: string[] = [];
    if (r.tipo === "Propietario" || r.tipo === "Arrendatario") tags.push(r.tipo);

    return {
      building_id: ctx.buildingId!,
      unit_code: r.unitCode.trim().toUpperCase(),
      name: r.name.trim(),
      household: r.household?.trim() || null,
      rut: r.rut?.trim() || null,
      contact: r.contact?.trim() || null,
      status: validStatuses.includes(r.status?.toLowerCase() ?? "")
        ? (r.status!.toLowerCase() as "activo" | "pendiente" | "inactivo")
        : "activo",
      tags,
    };
  });

  // Fetch existing unit codes for this building to split insert vs update
  const { data: existing } = await db
    .from("residents")
    .select("id, unit_code")
    .eq("building_id", ctx.buildingId);

  const existingMap = new Map((existing ?? []).map((r) => [r.unit_code, r.id]));

  const toInsert = records.filter((r) => !existingMap.has(r.unit_code));
  const toUpdate = records.filter((r) => existingMap.has(r.unit_code));

  let inserted = 0;
  const updateErrors: string[] = [];

  if (toInsert.length > 0) {
    const { error, count } = await db.from("residents").insert(toInsert).select();
    if (error) return { ok: false, inserted: 0, error: error.message };
    inserted += count ?? toInsert.length;
  }

  for (const r of toUpdate) {
    const id = existingMap.get(r.unit_code)!;
    const { error } = await db
      .from("residents")
      .update({ name: r.name, household: r.household, rut: r.rut, contact: r.contact, status: r.status, tags: r.tags })
      .eq("id", id);
    if (error) updateErrors.push(r.unit_code);
    else inserted++;
  }

  if (updateErrors.length > 0) {
    return { ok: true, inserted, error: `Advertencia: no se pudieron actualizar ${updateErrors.length} unidades (${updateErrors.join(", ")})` };
  }

  return { ok: true, inserted };
}

// ── Onboarding ───────────────────────────────────────────────────

export async function createOnboardingOrg(input: {
  name: string;
  city?: string;
}): Promise<{ ok: boolean; orgId?: string; error?: string }> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: "No autenticado" };

  // El onboarding es para quien acaba de registrarse y no pertenece a
  // ninguna organización. Sin esto, un conserje invitado podía crearse
  // una organización propia y sacarse del condominio que lo contrató.
  if (ctx.organizationId) {
    return { ok: false, error: "Tu cuenta ya pertenece a una organización" };
  }
  if (ctx.role !== "admin") {
    return { ok: false, error: "Solo una cuenta de administrador puede crear una organización" };
  }

  const user = ctx.user;
  const db = createServiceClient();

  const slug =
    input.name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "") +
    "-" +
    Date.now().toString(36);

  const { data: org, error: orgErr } = await db
    .from("organizations")
    .insert({ name: input.name, slug })
    .select("id")
    .single();

  if (orgErr || !org) {
    return { ok: false, error: orgErr?.message ?? "Error al crear la organización" };
  }

  await db
    .from("profiles")
    .update({ organization_id: org.id })
    .eq("id", user.id);

  return { ok: true, orgId: org.id };
}

export async function createOnboardingBuilding(input: {
  name: string;
  address?: string;
  orgId: string;
  towers: number;
  unitsPerTower: number;
}): Promise<{ ok: boolean; buildingId?: string; error?: string }> {
  const ctx = await getAdminContext();
  if (!ctx) return { ok: false, error: NO_ADMIN };

  // El edificio se cuelga de la organización de la sesión, no del orgId
  // que llega del cliente: si no, se podían crear edificios dentro de
  // la organización de otro.
  const organizationId = ctx.organizationId;
  if (!organizationId) {
    return { ok: false, error: "Primero tienes que crear tu organización" };
  }
  if (ctx.buildingId) {
    return { ok: false, error: "Tu organización ya tiene un edificio registrado" };
  }

  const db = createServiceClient();

  const { data: building, error } = await db
    .from("buildings")
    .insert({
      name: input.name,
      address: input.address ?? null,
      units_total: input.towers * input.unitsPerTower,
      organization_id: organizationId,
    })
    .select("id")
    .single();

  if (error || !building) {
    return { ok: false, error: error?.message ?? "Error al crear el edificio" };
  }

  return { ok: true, buildingId: building.id };
}

export async function inviteConserje(input: {
  email: string;
  name?: string;
  organizationId: string;
}): Promise<{ ok: boolean; error?: string }> {
  const ctx = await getAdminContext();
  if (!ctx) return { ok: false, error: NO_ADMIN };

  // La organización sale de la sesión, no de lo que manda el cliente:
  // así nadie puede invitar gente a una organización ajena.
  const organizationId = ctx.organizationId;
  if (!organizationId) return { ok: false, error: "Organización no encontrada" };

  const db = createServiceClient();

  // Resolve the building for this org so we can create the staff record
  const { data: building } = await db
    .from("buildings")
    .select("id")
    .eq("organization_id", organizationId)
    .limit(1)
    .maybeSingle();

  const { error } = await db.auth.admin.inviteUserByEmail(input.email, {
    data: {
      role: "conserje",
      organization_id: organizationId,
      ...(input.name ? { full_name: input.name } : {}),
    },
    redirectTo: `${appUrl()}/auth/callback?next=/update-password`,
  });

  if (error) return { ok: false, error: error.message };

  // Create the staff record so they appear in the personnel list immediately
  if (building?.id) {
    await db.from("staff").insert({
      building_id: building.id,
      name: input.name ?? input.email,
      role: "Conserje",
      active: true,
    });
  }

  return { ok: true };
}

// Se llama desde update-password, cuando el conserje invitado define su
// contraseña. La organización y el rol salen del user_metadata que grabó
// la invitación — leído acá en el servidor, no recibido del cliente:
// aceptarlos del cliente permitía que cualquier usuario se declarara
// admin de la organización que quisiera.
export async function syncInvitedProfile(input: {
  fullName?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "No autenticado" };

  const meta = user.user_metadata ?? {};
  const organizationId = typeof meta.organization_id === "string" ? meta.organization_id : null;
  const role = meta.role === "admin" || meta.role === "conserje" || meta.role === "residente"
    ? meta.role
    : "conserje";

  if (!organizationId) {
    return { ok: false, error: "Tu invitación no tiene una organización asociada. Pide una nueva al administrador." };
  }

  const fullName = input.fullName?.trim() || (typeof meta.full_name === "string" ? meta.full_name : undefined);

  const db = createServiceClient();

  const { error } = await db.from("profiles").upsert({
    id: user.id,
    organization_id: organizationId,
    role,
    ...(fullName ? { full_name: fullName } : {}),
  });

  if (error) return { ok: false, error: error.message };

  // Residente invitado: dejarlo ligado a su unidad, que es lo que le
  // permite aprobar visitas.
  const residentId = typeof meta.resident_id === "string" ? meta.resident_id : null;
  if (role === "residente" && residentId) {
    const { data: resident } = await db
      .from("residents")
      .select("building_id")
      .eq("id", residentId)
      .maybeSingle();

    if (resident?.building_id) {
      await db.from("resident_members").upsert(
        { resident_id: residentId, profile_id: user.id, building_id: resident.building_id },
        { onConflict: "resident_id,profile_id" }
      );
    }
  }

  // Update the staff record: replace the email placeholder with the real name
  if (fullName && user.email) {
    const { data: building } = await db
      .from("buildings")
      .select("id")
      .eq("organization_id", organizationId)
      .limit(1)
      .maybeSingle();

    if (building?.id) {
      await db
        .from("staff")
        .update({ name: fullName })
        .eq("building_id", building.id)
        .eq("name", user.email);
    }
  }

  return { ok: true };
}

// Registers the conserje's arrival for the day (once per day, idempotent).
// Marks the scheduled shift as active and logs the entry.
export async function registerConserjeArrival(): Promise<{ ok: boolean; alreadyRegistered?: boolean }> {
  const ctx = await getSessionContext();
  if (!ctx?.buildingId || ctx.role !== "conserje") return { ok: false };

  const db = createServiceClient();
  // El día del edificio. Con UTC, el conserje que entra al turno de noche
  // quedaba registrado dos veces: a las 20:00 ya era "otro día".
  const todayStart = startOfTodayUtc();

  // Idempotency: skip if already registered today
  const { data: existing } = await db
    .from("access_log")
    .select("id")
    .eq("building_id", ctx.buildingId)
    .eq("who", ctx.staffName)
    .eq("context", "Inicio de turno")
    .gte("recorded_at", todayStart)
    .limit(1)
    .maybeSingle();

  if (existing) return { ok: true, alreadyRegistered: true };

  // Log the arrival
  await db.from("access_log").insert({
    building_id: ctx.buildingId,
    type: "in",
    who: ctx.staffName,
    context: "Inicio de turno",
    recorded_by: ctx.staffName,
  });

  // Abrir la jornada del conserje: sus horas se cuentan igual que las del
  // jardinero o la señora del aseo, y `abrirJornada` deja además el turno
  // programado marcado como activo.
  const staff = await findStaffByName(ctx.buildingId, ctx.staffName);
  if (staff) {
    await abrirJornada({ buildingId: ctx.buildingId, staff, source: "sesion" });
  }

  return { ok: true, alreadyRegistered: false };
}

// Conserje marks end of shift — logs exit and marks shift as completed.
export async function endShift(): Promise<{ ok: boolean; error?: string }> {
  const ctx = await getSessionContext();
  if (!ctx?.buildingId || ctx.role !== "conserje") return { ok: false, error: "No autorizado" };

  const db = createServiceClient();

  await db.from("access_log").insert({
    building_id: ctx.buildingId,
    type: "out",
    who: ctx.staffName,
    context: "Fin de turno",
    recorded_by: ctx.staffName,
  });

  // Cerrar la jornada abierta cierra también el turno programado. Antes esto
  // buscaba el turno por `new Date().toISOString()`, que es la fecha en UTC:
  // el conserje que terminaba después de las 20:00 dejaba su turno colgado
  // como activo porque para el servidor ya era mañana.
  const staff = await findStaffByName(ctx.buildingId, ctx.staffName);
  if (staff) {
    const abierta = await getOpenAttendance(staff.id);
    if (abierta) {
      await cerrarJornada({ buildingId: ctx.buildingId, abierta, source: "sesion" });
    } else {
      await db
        .from("shifts")
        .update({ status: "completado" })
        .eq("building_id", ctx.buildingId)
        .eq("staff_id", staff.id)
        .eq("date", todayInChile())
        .eq("status", "activo");
    }
  }

  return { ok: true };
}

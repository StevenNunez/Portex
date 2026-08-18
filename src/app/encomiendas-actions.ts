"use server";

import { revalidatePath } from "next/cache";
import { getUserContext } from "@/lib/user-context";
import { insertAccessLog } from "@/lib/db";
import { normalizeRut } from "@/lib/rut";
import { findPassByCodeOrToken } from "@/lib/citofono";
import { QR_PREFIJO } from "@/lib/qr";
import {
  QR_ENCOMIENDA,
  findParcelByCodeOrToken,
  getParcelsForUnit,
  marcarRetirada,
  type ParcelRow,
} from "@/lib/encomiendas";
import { getResidentIdsForProfile } from "@/lib/citofono";

/**
 * Entrega de encomiendas y el escáner de portería.
 *
 * El conserje tiene una sola pantalla para escanear: lo que le muestren
 * puede ser el pase de una visita o el código de un paquete, y el sistema
 * decide qué es. Un dato menos que recordar en el peor momento del día.
 */

async function contextoPorteria() {
  const ctx = await getUserContext();
  if (!ctx) return { error: "Sesión expirada. Vuelve a entrar." as const };
  if (ctx.role !== "conserje" && ctx.role !== "admin") {
    return { error: "Solo la portería puede hacer esto" as const };
  }
  if (!ctx.buildingId) return { error: "Edificio no encontrado" as const };
  return { ctx: { ...ctx, buildingId: ctx.buildingId } };
}

// ── Entrega ───────────────────────────────────────────────────────

export interface EntregaResult {
  ok: boolean;
  error?: string;
  /** Cómo quedó registrada la entrega, para decírselo al conserje. */
  method?: "codigo" | "qr" | "manual";
}

export async function entregarEncomienda(input: {
  parcelId: string;
  pickedUpBy: string;
  rut?: string;
  /** El código que dictó quien vino a buscarla, si lo trajo. */
  code?: string;
  /**
   * El texto crudo del QR escaneado. Se vuelve a comprobar acá contra el
   * token del paquete: que la entrega quede marcada como verificada no puede
   * depender de que el navegador lo diga.
   */
  scan?: string;
}): Promise<EntregaResult> {
  const { ctx, error } = await contextoPorteria();
  if (!ctx) return { ok: false, error };

  const nombre = input.pickedUpBy.trim();
  if (nombre.length < 2) {
    return { ok: false, error: "Escribe el nombre de quien retira" };
  }

  const parcel = await buscarPorId(ctx.buildingId, input.parcelId);
  if (!parcel) return { ok: false, error: "Esa encomienda no es de este edificio" };
  if (parcel.status !== "pendiente") {
    return { ok: false, error: "Esa encomienda ya había sido retirada" };
  }

  // El código es lo que separa "se la llevó quien correspondía" de "el
  // conserje confió". Las dos entregas son válidas; la diferencia queda
  // escrita, que es lo que importa cuando alguien reclama.
  const dictado = (input.code ?? "").replace(/[^0-9]/g, "");
  const escaneado = (input.scan ?? "").trim();
  let method: "codigo" | "qr" | "manual" = "manual";

  if (escaneado.toUpperCase().startsWith(QR_ENCOMIENDA)) {
    const token = escaneado.slice(QR_ENCOMIENDA.length).trim();
    if (token !== parcel.token) {
      return { ok: false, error: "Ese QR no corresponde a esta encomienda" };
    }
    method = "qr";
  } else if (dictado.length === 6) {
    if (dictado !== parcel.code) {
      return { ok: false, error: "Ese código no corresponde a esta encomienda" };
    }
    method = "codigo";
  }

  const row = await insertAccessLog({
    building_id: ctx.buildingId,
    type: "out",
    who: nombre,
    context: "Encomienda retirada",
    unit: parcel.unit_code ?? undefined,
    recorded_by: ctx.staffName,
    rut: input.rut ? normalizeRut(input.rut) : undefined,
    authorized_by:
      method === "manual"
        ? "Entrega sin código"
        : method === "qr"
        ? "Retiro verificado · QR"
        : "Retiro verificado · código",
  });

  const res = await marcarRetirada({
    buildingId: ctx.buildingId,
    parcelId: parcel.id,
    pickedUpBy: nombre,
    pickedUpRut: input.rut ? normalizeRut(input.rut) : null,
    method,
    pickupLogId: row.id,
  });

  if (!res.ok) return { ok: false, error: res.error };

  revalidatePath("/conserje");
  revalidatePath("/admin/encomiendas");
  return { ok: true, method };
}

async function buscarPorId(buildingId: string, parcelId: string): Promise<ParcelRow | null> {
  const { createServerClient } = await import("@/lib/supabase-server");
  const { data } = await createServerClient()
    .from("parcels")
    .select(
      "id, resident_id, unit_code, courier, description, code, token, status, received_at, received_by, notified_at, picked_up_at, picked_up_by, picked_up_rut, pickup_method"
    )
    .eq("id", parcelId)
    .eq("building_id", buildingId)
    .maybeSingle();
  return (data as ParcelRow) ?? null;
}

// ── Escáner unificado ─────────────────────────────────────────────

export interface ScanResult {
  ok: boolean;
  error?: string;
  tipo?: "pase" | "encomienda";
  /** Pase de visita. */
  pase?: {
    passId: string;
    visitorName: string;
    visitorRut: string | null;
    plate: string | null;
    note: string | null;
    unitCode: string;
    residentName: string;
    authorizedBy: string | null;
    validUntil: string;
  };
  /** Encomienda esperando retiro. */
  encomienda?: {
    parcelId: string;
    code: string;
    courier: string | null;
    unitCode: string | null;
    residentName: string | null;
    receivedAt: string;
    /** El QR trajo el código: la persona demostró que le corresponde. */
    fromQr: boolean;
  };
}

/**
 * Qué me están mostrando: ¿un pase de visita o el código de un paquete?
 *
 * Por el prefijo del QR se sabe de inmediato. Cuando es un código dictado,
 * el rango decide (los pases viven en 100000–499999 y las encomiendas en
 * 500000–999999), pero igual se busca en la otra tabla si no aparece: el
 * rango es una ayuda, no una regla que pueda dejar a alguien en la puerta.
 */
export async function lookupScan(entrada: string): Promise<ScanResult> {
  const { ctx, error } = await contextoPorteria();
  if (!ctx) return { ok: false, error };

  const limpio = entrada.trim();
  const esQrPase = limpio.toUpperCase().startsWith(QR_PREFIJO);
  const esQrEncomienda = limpio.toUpperCase().startsWith(QR_ENCOMIENDA);
  const digitos = limpio.replace(/\D/g, "");

  const buscarPase = async (): Promise<ScanResult | null> => {
    const found = await findPassByCodeOrToken(ctx.buildingId, limpio);
    if (!found) return null;
    return {
      ok: true,
      tipo: "pase",
      pase: {
        passId: found.pass.id,
        visitorName: found.pass.visitor_name,
        visitorRut: found.pass.visitor_rut,
        plate: found.pass.plate,
        note: found.pass.note,
        unitCode: found.unitCode,
        residentName: found.residentName,
        authorizedBy: found.pass.created_by_name,
        validUntil: found.pass.valid_until,
      },
    };
  };

  const buscarEncomienda = async (): Promise<ScanResult | null> => {
    const parcel = await findParcelByCodeOrToken(ctx.buildingId, limpio);
    if (!parcel) return null;

    let residentName: string | null = null;
    if (parcel.unit_code) {
      const { createServerClient } = await import("@/lib/supabase-server");
      const { data } = await createServerClient()
        .from("residents")
        .select("name")
        .eq("building_id", ctx.buildingId)
        .eq("unit_code", parcel.unit_code)
        .limit(1)
        .maybeSingle();
      residentName = data?.name ?? null;
    }

    return {
      ok: true,
      tipo: "encomienda",
      encomienda: {
        parcelId: parcel.id,
        code: parcel.code,
        courier: parcel.courier,
        unitCode: parcel.unit_code,
        residentName,
        receivedAt: parcel.received_at,
        fromQr: esQrEncomienda,
      },
    };
  };

  // Con QR no hay ambigüedad posible.
  if (esQrPase) return (await buscarPase()) ?? sinResultado(true);
  if (esQrEncomienda) return (await buscarEncomienda()) ?? sinResultado(true);

  if (digitos.length !== 6) {
    return { ok: false, error: "El código son 6 dígitos" };
  }

  const primero = Number(digitos) >= 500_000 ? buscarEncomienda : buscarPase;
  const segundo = Number(digitos) >= 500_000 ? buscarPase : buscarEncomienda;

  return (await primero()) ?? (await segundo()) ?? sinResultado(false);
}

function sinResultado(qr: boolean): ScanResult {
  return {
    ok: false,
    error: qr
      ? "Ese QR no corresponde a nada vigente en este edificio."
      : "No hay ningún pase ni encomienda con ese código.",
  };
}

// ── Lado residente ────────────────────────────────────────────────

/** Las encomiendas del departamento de la sesión. */
export async function getMisEncomiendas(): Promise<ParcelRow[]> {
  const ctx = await getUserContext();
  if (!ctx?.buildingId) return [];

  const unidades = await getResidentIdsForProfile(ctx.userId);
  if (unidades.length === 0) return [];

  return getParcelsForUnit(ctx.buildingId, unidades[0].unitCode);
}

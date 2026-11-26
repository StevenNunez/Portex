"use server";

import { revalidatePath } from "next/cache";
import { getUserContext } from "@/lib/user-context";
import { createServerClient as createServiceClient } from "@/lib/supabase-server";
import { normalizeRut } from "@/lib/rut";
import { startOfDayUtc } from "@/lib/fecha";
import {
  JORNADA_MAXIMA_HORAS,
  abrirJornada,
  cerrarJornada,
  findStaffByRut,
  getOpenAttendance,
  shiftBounds,
  type ShiftLite,
} from "@/lib/asistencia";
import { fallo } from "@/lib/errores-servidor";

/**
 * Marcaje de asistencia del personal.
 *
 * Quien marca es el trabajador, con su RUT, en la tablet que ya está en
 * portería. Esa tablet tiene la sesión del conserje de turno, así que la
 * acción exige sesión del edificio: nadie puede marcar horas desde afuera.
 * El RUT identifica a la persona, la sesión identifica al edificio.
 */

export interface MarcaResult {
  ok: boolean;
  error?: string;
  action?: "entrada" | "salida";
  staffName?: string;
  role?: string;
  at?: string;
  lateMinutes?: number | null;
  earlyLeaveMinutes?: number | null;
  workedMinutes?: number | null;
  shiftLabel?: string | null;
  /** Se cerró sola una jornada que había quedado sin salida. */
  cerroJornadaOlvidada?: boolean;
}

function shiftLabel(shift: ShiftLite | null | undefined): string | null {
  if (!shift) return null;
  return `${shift.start_time.slice(0, 5)} – ${shift.end_time.slice(0, 5)}`;
}

/** La portería y el panel: los dos muestran quién está adentro. */
async function refrescarPantallas() {
  revalidatePath("/conserje");
  revalidatePath("/admin/asistencia");
}

export async function markAttendanceByRut(rut: string): Promise<MarcaResult> {
  const ctx = await getUserContext();
  if (!ctx) return { ok: false, error: "Sesión expirada. Vuelve a entrar." };
  if (ctx.role !== "conserje" && ctx.role !== "admin") {
    return { ok: false, error: "El marcaje se hace en la tablet de portería." };
  }
  if (!ctx.buildingId) return { ok: false, error: "Edificio no encontrado" };

  if (normalizeRut(rut).length < 7) {
    return { ok: false, error: "Escribe el RUT completo" };
  }

  const staff = await findStaffByRut(ctx.buildingId, rut);
  if (!staff) {
    return {
      ok: false,
      error: "Ese RUT no está en el personal del edificio. Avísale al administrador.",
    };
  }

  const abierta = await getOpenAttendance(staff.id);

  // Marcar es un solo gesto: el sistema sabe si esta persona está entrando
  // o saliendo. Nadie tiene que elegir el botón correcto a las 6 de la mañana.
  if (abierta) {
    const res = await cerrarJornada({
      buildingId: ctx.buildingId,
      abierta,
      source: "tablet",
    });
    if (!res.ok) return { ok: false, error: res.error };

    await refrescarPantallas();
    return {
      ok: true,
      action: "salida",
      staffName: staff.name,
      role: staff.role,
      at: res.at,
      workedMinutes: res.workedMinutes ?? null,
      earlyLeaveMinutes: res.earlyLeaveMinutes ?? null,
      shiftLabel: shiftLabel(res.shift),
    };
  }

  const res = await abrirJornada({
    buildingId: ctx.buildingId,
    staff,
    source: "tablet",
  });
  if (!res.ok) return { ok: false, error: res.error };

  await refrescarPantallas();
  return {
    ok: true,
    action: "entrada",
    staffName: staff.name,
    role: staff.role,
    at: res.at,
    lateMinutes: res.lateMinutes ?? null,
    shiftLabel: shiftLabel(res.shift),
    cerroJornadaOlvidada: res.cerroJornadaOlvidada,
  };
}

/**
 * El administrador cierra una jornada que quedó abierta.
 *
 * Pasa siempre: alguien se va sin marcar. Sin esto la persona no puede
 * volver a marcar entrada al día siguiente (no puede haber dos jornadas
 * abiertas) y las horas del mes quedan infladas para siempre.
 */
export async function closeAttendanceAsAdmin(input: {
  attendanceId: string;
  /** "HH:MM" en hora de Chile. */
  time: string;
  note?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const ctx = await getUserContext();
  if (!ctx || ctx.role !== "admin") {
    return { ok: false, error: "Solo el administrador puede cerrar una jornada" };
  }
  if (!ctx.buildingId) return { ok: false, error: "Edificio no encontrado" };

  if (!/^\d{2}:\d{2}$/.test(input.time)) {
    return { ok: false, error: "Hora inválida" };
  }

  const db = createServiceClient();
  const { data: row } = await db
    .from("attendance")
    .select("id, staff_id, date, checked_in_at, checked_out_at, shift_id, building_id")
    .eq("id", input.attendanceId)
    .eq("building_id", ctx.buildingId)
    .maybeSingle();

  if (!row) return { ok: false, error: "Esa jornada no es de tu edificio" };
  if (row.checked_out_at) return { ok: false, error: "Esa jornada ya estaba cerrada" };

  const [h, m] = input.time.split(":").map(Number);
  const entrada = new Date(row.checked_in_at).getTime();
  let salida = new Date(startOfDayUtc(row.date)).getTime() + (h * 60 + m) * 60_000;

  // "Salió a las 02:00" con entrada a las 22:00 es la madrugada siguiente,
  // no cuatro horas antes de llegar.
  if (salida < entrada) salida += 86_400_000;

  // Pero si eso deja una jornada imposible, lo que pasó es que el
  // administrador se equivocó de hora: un turno de noche completo son ocho
  // horas, no veintitrés.
  const horas = (salida - entrada) / 3_600_000;
  if (horas > JORNADA_MAXIMA_HORAS) {
    return {
      ok: false,
      error: `Esa hora deja una jornada de ${Math.round(horas)} horas. Si la salida es anterior a la entrada se entiende como la madrugada siguiente — revisa la hora.`,
    };
  }

  let early: number | null = null;
  if (row.shift_id) {
    const { data: shift } = await db
      .from("shifts")
      .select("id, date, type, start_time, end_time, location")
      .eq("id", row.shift_id)
      .maybeSingle();
    if (shift) {
      const { end } = shiftBounds(shift as ShiftLite);
      const diff = Math.round((end - salida) / 60_000);
      early = diff > 0 ? diff : 0;
    }
  }

  const { error } = await db
    .from("attendance")
    .update({
      checked_out_at: new Date(salida).toISOString(),
      early_leave_minutes: early,
      closed_source: "admin",
      note: input.note?.trim() || "Cerrada por el administrador",
    })
    .eq("id", row.id)
    .is("checked_out_at", null);

  if (error) return { ok: false, error: await fallo("closeAttendanceAsAdmin", error) };

  await refrescarPantallas();
  return { ok: true };
}

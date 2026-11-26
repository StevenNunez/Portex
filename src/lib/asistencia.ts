import "server-only";

import { createServerClient } from "./supabase-server";
import { normalizeRut } from "./rut";
import { minutesFromTime, startOfDayUtc, todayInChile } from "./fecha";
import type { AttendanceSource } from "./database.types";
import { fallo } from "@/lib/errores-servidor";

/**
 * Asistencia del personal.
 *
 * El jardinero, la señora del aseo y el maestro no tienen cuenta ni clave:
 * marcan con su RUT en la tablet de portería. Cada jornada es una fila que
 * se abre al llegar y se cierra al irse; mientras no tenga salida, la
 * persona está adentro.
 *
 * El atraso se calcula **en el momento de marcar**, no al mirar el reporte:
 * el administrador puede cambiar el turno después, pero lo que pasó ese día
 * ya pasó.
 */

/** Minutos de gracia antes de contar un atraso. */
export const TOLERANCIA_MINUTOS = 5;

/** Una jornada más larga que esto es alguien que se fue sin marcar salida. */
export const JORNADA_MAXIMA_HORAS = 16;

/** Cuánto puede separarse un marcaje de la hora del turno para asociarlos. */
const VENTANA_TURNO_MS = 6 * 3_600_000;

export interface StaffLite {
  id: string;
  name: string;
  role: string;
  rut: string | null;
}

export interface ShiftLite {
  id: string;
  date: string;
  type: string;
  start_time: string;
  end_time: string;
  location: string | null;
}

export interface AttendanceRow {
  id: string;
  staff_id: string;
  date: string;
  checked_in_at: string;
  checked_out_at: string | null;
  shift_id: string | null;
  late_minutes: number | null;
  early_leave_minutes: number | null;
  source: string;
  closed_source: string | null;
  note: string | null;
  staff: StaffLite;
}

function db() {
  return createServerClient();
}

const SELECT_ROW =
  "id, staff_id, date, checked_in_at, checked_out_at, shift_id, late_minutes, early_leave_minutes, source, closed_source, note, staff!inner(id, name, role, rut)";

// ── Personal ──────────────────────────────────────────────────────

/**
 * Quién es este RUT dentro del personal del edificio.
 *
 * La comparación es en memoria y sobre el RUT normalizado: en la ficha del
 * trabajador el administrador lo escribió con puntos y guion, y en la tablet
 * se digita como sea. Un punto de diferencia no puede dejar a alguien sin
 * poder marcar su jornada.
 */
export async function findStaffByRut(
  buildingId: string,
  rut: string
): Promise<StaffLite | null> {
  const clean = normalizeRut(rut);
  if (clean.length < 7) return null;

  const { data, error } = await db()
    .from("staff")
    .select("id, name, role, rut")
    .eq("building_id", buildingId)
    .eq("active", true);

  if (error) throw error;

  const found = (data ?? []).find(
    (s) => s.rut != null && normalizeRut(s.rut) === clean
  );
  return (found as StaffLite) ?? null;
}

export async function findStaffByName(
  buildingId: string,
  name: string
): Promise<StaffLite | null> {
  const { data, error } = await db()
    .from("staff")
    .select("id, name, role, rut")
    .eq("building_id", buildingId)
    .eq("active", true)
    .eq("name", name)
    .limit(1)
    .maybeSingle();

  if (error) return null;
  return (data as StaffLite) ?? null;
}

// ── Jornadas ──────────────────────────────────────────────────────

/** La jornada abierta de esta persona, si está adentro. */
export async function getOpenAttendance(
  staffId: string
): Promise<AttendanceRow | null> {
  const { data, error } = await db()
    .from("attendance")
    .select(SELECT_ROW)
    .eq("staff_id", staffId)
    .is("checked_out_at", null)
    .maybeSingle();

  if (error) throw error;
  return (data as unknown as AttendanceRow) ?? null;
}

/**
 * Todo el personal que está dentro del edificio ahora mismo.
 *
 * `minutosDentro` se calcula acá y no en la pantalla: el reloj es impuro y
 * leerlo durante el render deja la cifra a merced de cuántas veces React
 * decida repintar. Acá queda fijado al instante de la consulta.
 */
export type PresentRow = AttendanceRow & { minutosDentro: number };

export async function getPresentStaff(buildingId: string): Promise<PresentRow[]> {
  const { data, error } = await db()
    .from("attendance")
    .select(SELECT_ROW)
    .eq("building_id", buildingId)
    .is("checked_out_at", null)
    .order("checked_in_at", { ascending: true });

  if (error) throw error;

  const ahora = Date.now();
  return ((data ?? []) as unknown as AttendanceRow[]).map((row) => ({
    ...row,
    minutosDentro: Math.max(0, Math.round((ahora - new Date(row.checked_in_at).getTime()) / 60_000)),
  }));
}

/** Las jornadas desde una fecha (inclusive), la más reciente primero. */
export async function getAttendanceSince(
  buildingId: string,
  dateFrom: string,
  limit = 2000
): Promise<AttendanceRow[]> {
  const { data, error } = await db()
    .from("attendance")
    .select(SELECT_ROW)
    .eq("building_id", buildingId)
    .gte("date", dateFrom)
    .order("date", { ascending: false })
    .order("checked_in_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as unknown as AttendanceRow[];
}

// ── Turnos programados ────────────────────────────────────────────

/**
 * El principio y el fin del turno como instantes reales.
 *
 * Un turno de noche (22:00 → 06:00) termina al día siguiente: sin esto, la
 * salida del conserje de noche se leería como una jornada de 16 horas
 * negativas y el atraso saldría al revés.
 */
export function shiftBounds(shift: ShiftLite): { start: number; end: number } {
  const base = new Date(startOfDayUtc(shift.date)).getTime();
  const start = base + minutesFromTime(shift.start_time) * 60_000;
  let end = base + minutesFromTime(shift.end_time) * 60_000;
  if (end <= start) end += 86_400_000;
  return { start, end };
}

/**
 * Turnos de esta persona que pueden estar en juego ahora: los de hoy y los
 * de ayer, porque el turno de noche que arrancó ayer sigue corriendo a las
 * 02:00 de la madrugada.
 */
export async function getShiftsAround(
  buildingId: string,
  staffId: string,
  date: string
): Promise<ShiftLite[]> {
  const ayer = new Date(new Date(date + "T12:00:00Z").getTime() - 86_400_000)
    .toISOString()
    .slice(0, 10);

  const { data, error } = await db()
    .from("shifts")
    .select("id, date, type, start_time, end_time, location")
    .eq("building_id", buildingId)
    .eq("staff_id", staffId)
    .in("date", [ayer, date])
    .order("date")
    .order("start_time");

  if (error) throw error;
  return (data ?? []) as ShiftLite[];
}

/** El turno que mejor explica un marcaje hecho en `at`. */
export function pickShiftForEntry(shifts: ShiftLite[], at: number): ShiftLite | null {
  let best: { shift: ShiftLite; diff: number } | null = null;

  for (const s of shifts) {
    const { start } = shiftBounds(s);
    const diff = Math.abs(at - start);
    if (diff > VENTANA_TURNO_MS) continue;
    if (!best || diff < best.diff) best = { shift: s, diff };
  }

  return best?.shift ?? null;
}

/** El turno que estaba corriendo (o recién terminado) cuando alguien se fue. */
export function pickShiftForExit(shifts: ShiftLite[], at: number): ShiftLite | null {
  let best: { shift: ShiftLite; diff: number } | null = null;

  for (const s of shifts) {
    const { end } = shiftBounds(s);
    const diff = Math.abs(at - end);
    if (diff > VENTANA_TURNO_MS) continue;
    if (!best || diff < best.diff) best = { shift: s, diff };
  }

  return best?.shift ?? null;
}

/** Minutos de atraso, ya descontada la tolerancia. */
export function atrasoMinutos(shift: ShiftLite, at: number): number {
  const { start } = shiftBounds(shift);
  const diff = Math.round((at - start) / 60_000);
  return diff > TOLERANCIA_MINUTOS ? diff : 0;
}

/** Minutos que faltaron para completar el turno. */
export function salidaAnticipadaMinutos(shift: ShiftLite, at: number): number {
  const { end } = shiftBounds(shift);
  const diff = Math.round((end - at) / 60_000);
  return diff > TOLERANCIA_MINUTOS ? diff : 0;
}

// ── Resumen para el panel ─────────────────────────────────────────

export interface StaffSummary {
  staffId: string;
  name: string;
  role: string;
  jornadas: number;
  minutos: number;
  /** Jornadas sin salida marcada: sus horas no se pueden contar. */
  abiertas: number;
  atrasos: number;
  minutosAtraso: number;
}

/** Minutos trabajados en una jornada ya cerrada. */
export function minutosTrabajados(row: AttendanceRow): number | null {
  if (!row.checked_out_at) return null;
  const ms = new Date(row.checked_out_at).getTime() - new Date(row.checked_in_at).getTime();
  return Math.max(0, Math.round(ms / 60_000));
}

export function resumenPorPersona(rows: AttendanceRow[]): StaffSummary[] {
  const porPersona = new Map<string, StaffSummary>();

  for (const row of rows) {
    const acc = porPersona.get(row.staff_id) ?? {
      staffId: row.staff_id,
      name: row.staff.name,
      role: row.staff.role,
      jornadas: 0,
      minutos: 0,
      abiertas: 0,
      atrasos: 0,
      minutosAtraso: 0,
    };

    const minutos = minutosTrabajados(row);
    if (minutos == null) {
      acc.abiertas += 1;
    } else {
      acc.jornadas += 1;
      acc.minutos += minutos;
    }
    if (row.late_minutes && row.late_minutes > 0) {
      acc.atrasos += 1;
      acc.minutosAtraso += row.late_minutes;
    }

    porPersona.set(row.staff_id, acc);
  }

  return [...porPersona.values()].sort((a, b) => b.minutos - a.minutos);
}

/** 495 → "8h 15m". Es como se leen las horas del mes, no en decimales. */
export function formatoDuracion(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// ── Abrir y cerrar jornada ────────────────────────────────────────
//
// La lógica vive acá y no en las Server Actions porque hay dos caminos
// que llegan a lo mismo: el trabajador que marca con su RUT en la tablet
// y el conserje que abre sesión en la portería. Las horas del mes tienen
// que salir iguales por los dos lados.

export interface MarcaEntrada {
  ok: boolean;
  error?: string;
  attendanceId?: string;
  at?: string;
  lateMinutes?: number | null;
  shift?: ShiftLite | null;
  /** Se cerró una jornada anterior que había quedado sin salida marcada. */
  cerroJornadaOlvidada?: boolean;
}

export async function abrirJornada(input: {
  buildingId: string;
  staff: StaffLite;
  source: AttendanceSource;
  at?: Date;
}): Promise<MarcaEntrada> {
  const at = input.at ?? new Date();
  const ms = at.getTime();

  // ¿Quedó una jornada abierta de antes? Si lleva más de un día es que
  // esa persona se fue sin marcar salida: cerrarla acá es lo único que
  // permite registrar la llegada de hoy, porque nadie puede tener dos
  // jornadas abiertas.
  const abierta = await getOpenAttendance(input.staff.id);
  let cerroJornadaOlvidada = false;

  if (abierta) {
    const horas = (ms - new Date(abierta.checked_in_at).getTime()) / 3_600_000;
    if (horas < JORNADA_MAXIMA_HORAS) {
      return { ok: false, error: "Ya tienes una jornada abierta: marca tu salida." };
    }
    await cerrarJornadaOlvidada(abierta);
    cerroJornadaOlvidada = true;
  }

  const date = todayInChile(at);
  const shifts = await getShiftsAround(input.buildingId, input.staff.id, date);
  const shift = pickShiftForEntry(shifts, ms);

  const { data, error } = await db()
    .from("attendance")
    .insert({
      building_id: input.buildingId,
      staff_id: input.staff.id,
      date,
      checked_in_at: at.toISOString(),
      shift_id: shift?.id ?? null,
      late_minutes: shift ? atrasoMinutos(shift, ms) : null,
      source: input.source,
    })
    .select("id")
    .single();

  if (error) {
    // 23505: dos toques al mismo tiempo. El primero ya abrió la jornada.
    if (error.code === "23505") {
      return { ok: false, error: "Tu entrada ya estaba registrada." };
    }
    return { ok: false, error: await fallo("abrirJornada", error) };
  }

  // El turno programado pasa a estar corriendo.
  if (shift) {
    await db()
      .from("shifts")
      .update({ status: "activo" })
      .eq("id", shift.id)
      .eq("status", "programado");
  }

  return {
    ok: true,
    attendanceId: data.id,
    at: at.toISOString(),
    lateMinutes: shift ? atrasoMinutos(shift, ms) : null,
    shift,
    cerroJornadaOlvidada,
  };
}

/**
 * Cierra una jornada que quedó sin salida. No se inventa una hora: si había
 * turno programado se usa su hora de término, y si no, la jornada queda en
 * cero minutos con la nota a la vista para que el administrador la corrija.
 */
async function cerrarJornadaOlvidada(abierta: AttendanceRow): Promise<void> {
  let salida = abierta.checked_in_at;

  if (abierta.shift_id) {
    const { data: shift } = await db()
      .from("shifts")
      .select("id, date, type, start_time, end_time, location")
      .eq("id", abierta.shift_id)
      .maybeSingle();
    if (shift) salida = new Date(shiftBounds(shift as ShiftLite).end).toISOString();
  }

  await db()
    .from("attendance")
    .update({
      checked_out_at: salida,
      closed_source: "admin",
      note: "Sin salida marcada · cerrada automáticamente",
    })
    .eq("id", abierta.id);
}

export interface MarcaSalida {
  ok: boolean;
  error?: string;
  at?: string;
  workedMinutes?: number;
  earlyLeaveMinutes?: number | null;
  shift?: ShiftLite | null;
}

export async function cerrarJornada(input: {
  buildingId: string;
  abierta: AttendanceRow;
  source: AttendanceSource;
  at?: Date;
}): Promise<MarcaSalida> {
  const at = input.at ?? new Date();
  const ms = at.getTime();

  const shifts = await getShiftsAround(
    input.buildingId,
    input.abierta.staff_id,
    input.abierta.date
  );
  const shift =
    shifts.find((s) => s.id === input.abierta.shift_id) ?? pickShiftForExit(shifts, ms);

  const { error } = await db()
    .from("attendance")
    .update({
      checked_out_at: at.toISOString(),
      early_leave_minutes: shift ? salidaAnticipadaMinutos(shift, ms) : null,
      closed_source: input.source,
    })
    .eq("id", input.abierta.id)
    .is("checked_out_at", null);

  if (error) return { ok: false, error: await fallo("cerrarJornada", error) };

  if (shift) {
    await db()
      .from("shifts")
      .update({ status: "completado" })
      .eq("id", shift.id)
      .in("status", ["programado", "activo"]);
  }

  const worked = Math.max(
    0,
    Math.round((ms - new Date(input.abierta.checked_in_at).getTime()) / 60_000)
  );

  return {
    ok: true,
    at: at.toISOString(),
    workedMinutes: worked,
    earlyLeaveMinutes: shift ? salidaAnticipadaMinutos(shift, ms) : null,
    shift,
  };
}

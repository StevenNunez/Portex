"use server";

import { createServerClient } from "./supabase-server";
import { daysAgoInChile, hourInChile, startOfDayUtc, startOfTodayUtc, todayInChile } from "./fecha";
import type { AccessType } from "./database.types";
import { getPendingParcels } from "./encomiendas";

// ── Types ─────────────────────────────────────────────────────────

export interface ActivityRow {
  id: string;
  type: AccessType;
  who: string;
  context: string | null;
  unit: string | null;
  plate: string | null;
  recorded_by: string | null;
  recorded_at: string;
  /** Quién autorizó este ingreso: la unidad por app, un pase previo, o nadie. */
  authorized_by?: string | null;
  /** RUT normalizado (sin puntos ni guion). Columna propia desde la v5. */
  rut?: string | null;
}

export interface ResidentRow {
  id: string;
  unit_code: string;
  name: string;
  household: string | null;
  tags: string[];
  rut: string | null;
  contact: string | null;
  status: string;
  /** A qué correo se le mandó la invitación al portal, si se mandó. */
  invite_email: string | null;
  invited_at: string | null;
  /**
   * Si ya creó su contraseña y quedó ligado a la unidad. Es lo único que
   * importa de verdad: un invitado que nunca abrió el correo no puede
   * autorizar a nadie.
   */
  tieneCuenta: boolean;
}

export interface FrequentVisitorRow {
  id: string;
  name: string;
  rut: string | null;
  reason: string | null;
  default_unit: string | null;
  last_seen_at: string | null;
}

export interface StaffRow {
  id: string;
  name: string;
  role: string;
  rut: string | null;
  contact: string | null;
  /** El correo con el que entra a Portex. */
  email: string | null;
  /** A quién llamar si algo pasa en el turno. */
  emergency_name: string | null;
  emergency_phone: string | null;
  /** Su cuenta de Portex, si ya entró. */
  profile_id: string | null;
}

export interface ShiftRow {
  id: string;
  date: string;
  type: string;
  start_time: string;
  end_time: string;
  location: string | null;
  status: string;
  staff: StaffRow;
}

export interface DashboardStats {
  ingresos: number;
  salidas: number;
  encomiendas: number;
  vehiculos: number;
  pendientes: number;
  totalResidents: number;
  activeResidents: number;
}

export interface HourlyBucket {
  hour: number;
  ingresos: number;
  salidas: number;
}

// ── Queries ───────────────────────────────────────────────────────

export async function getRecentActivity(
  limit = 20,
  buildingId: string
): Promise<ActivityRow[]> {
  const db = createServerClient();
  const { data, error } = await db
    .from("access_log")
    .select("id, type, who, context, unit, plate, recorded_by, recorded_at, authorized_by")
    .eq("building_id", buildingId)
    .order("recorded_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function insertAccessLog(entry: {
  building_id: string;
  type: AccessType;
  who: string;
  context?: string;
  unit?: string;
  plate?: string;
  recorded_by?: string;
  request_id?: string;
  authorized_by?: string;
  rut?: string;
}): Promise<ActivityRow> {
  const db = createServerClient();
  const { data, error } = await db
    .from("access_log")
    .insert(entry)
    .select()
    .single();
  if (error) throw error;
  return data;
}

const CAMPOS_BASE = "id, unit_code, name, household, tags, rut, contact, status";
/** El código de PostgreSQL para "esa columna no existe". */
const COLUMNA_INEXISTENTE = "42703";

export async function getResidents(buildingId: string): Promise<ResidentRow[]> {
  const db = createServerClient();

  const [conAcceso, { data: miembros }] = await Promise.all([
    db
      .from("residents")
      .select(`${CAMPOS_BASE}, invite_email, invited_at`)
      .eq("building_id", buildingId)
      .order("unit_code", { ascending: true }),
    // Quiénes ya tienen cuenta. En consulta aparte y no con un join anidado
    // porque un residente puede tener varias cuentas ligadas (el titular y
    // su pareja) y acá solo interesa si hay al menos una.
    db.from("resident_members").select("resident_id").eq("building_id", buildingId),
  ]);

  let filas = conAcceso.data;

  // Esta lista también alimenta la pantalla de portería. Si el código se
  // despliega antes de correr `migration_v13_acceso_residentes.sql`, la
  // portería no puede quedarse caída por unas columnas que solo sirven en el
  // panel: se pide lo de siempre y el estado de acceso queda en blanco hasta
  // que la migración exista.
  if (conAcceso.error) {
    if (conAcceso.error.code !== COLUMNA_INEXISTENTE) throw conAcceso.error;

    const { data, error } = await db
      .from("residents")
      .select(CAMPOS_BASE)
      .eq("building_id", buildingId)
      .order("unit_code", { ascending: true });
    if (error) throw error;
    filas = (data ?? []).map((r) => ({ ...r, invite_email: null, invited_at: null }));
  }

  const conCuenta = new Set((miembros ?? []).map((m) => m.resident_id));

  return (filas ?? []).map((r) => ({ ...r, tieneCuenta: conCuenta.has(r.id) })) as ResidentRow[];
}

export async function getFrequentVisitors(
  buildingId: string
): Promise<FrequentVisitorRow[]> {
  const db = createServerClient();
  const { data, error } = await db
    .from("frequent_visitors")
    .select("id, name, rut, reason, default_unit, last_seen_at")
    .eq("building_id", buildingId)
    .order("last_seen_at", { ascending: false, nullsFirst: false });
  if (error) throw error;
  return data ?? [];
}

export async function getDashboardStats(
  buildingId: string
): Promise<DashboardStats> {
  const db = createServerClient();
  // El día del edificio, no el de UTC: después de las 20:00 en Chile ya no
  // coinciden y el panel mostraba todo en cero. Ver src/lib/fecha.ts.
  const desdeMedianoche = startOfTodayUtc();

  // "pendientes" son las encomiendas sin retirar de los últimos 30 días,
  // no las recibidas hoy: por eso sale de getPendingParcels y no del
  // conteo del día, que es lo que muestra el KPI "encomiendas hoy".
  const [activityRes, residentsRes, pendingParcels] = await Promise.all([
    db
      .from("access_log")
      .select("type")
      .eq("building_id", buildingId)
      .gte("recorded_at", desdeMedianoche),
    db
      .from("residents")
      .select("status")
      .eq("building_id", buildingId),
    getPendingParcels(buildingId),
  ]);

  if (activityRes.error) throw activityRes.error;
  if (residentsRes.error) throw residentsRes.error;

  const activity = activityRes.data ?? [];
  const residents = residentsRes.data ?? [];

  return {
    ingresos:        activity.filter((r) => ["in", "delivery", "provider"].includes(r.type)).length,
    salidas:         activity.filter((r) => r.type === "out").length,
    encomiendas:     activity.filter((r) => r.type === "parcel").length,
    vehiculos:       activity.filter((r) => r.type === "vehicle").length,
    pendientes:      pendingParcels.length,
    totalResidents:  residents.length,
    activeResidents: residents.filter((r) => r.status === "activo").length,
  };
}

export async function getHourlyActivity(
  buildingId: string
): Promise<HourlyBucket[]> {
  const db = createServerClient();

  const { data, error } = await db
    .from("access_log")
    .select("type, recorded_at")
    .eq("building_id", buildingId)
    .gte("recorded_at", startOfTodayUtc());

  if (error) throw error;

  const buckets: Record<number, HourlyBucket> = {};
  for (let h = 0; h < 24; h += 2) {
    buckets[h] = { hour: h, ingresos: 0, salidas: 0 };
  }

  for (const row of data ?? []) {
    // La hora del gráfico es la del edificio. `getHours()` usaría la del
    // servidor, que en Vercel es UTC: el ingreso de las 14:00 caía en la
    // barra de las 18:00.
    const h = hourInChile(row.recorded_at);
    const bucket = Math.floor(h / 2) * 2;
    if (!buckets[bucket]) buckets[bucket] = { hour: bucket, ingresos: 0, salidas: 0 };
    if (["in", "delivery", "provider"].includes(row.type)) buckets[bucket].ingresos++;
    else if (row.type === "out") buckets[bucket].salidas++;
  }

  return Object.values(buckets).sort((a, b) => a.hour - b.hour);
}

export async function getActivityByType(
  buildingId: string,
  types: AccessType[],
  limit = 100
): Promise<ActivityRow[]> {
  const db = createServerClient();
  const { data, error } = await db
    .from("access_log")
    .select("id, type, who, context, unit, plate, recorded_by, recorded_at, authorized_by")
    .eq("building_id", buildingId)
    .in("type", types)
    .order("recorded_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function getAllActivity(
  buildingId: string,
  limit = 200,
  dateFrom?: string
): Promise<ActivityRow[]> {
  const db = createServerClient();
  let q = db
    .from("access_log")
    // El RUT va solo acá: es la bitácora que se exporta, no el feed de portería.
    .select("id, type, who, context, unit, plate, recorded_by, recorded_at, authorized_by, rut")
    .eq("building_id", buildingId)
    .order("recorded_at", { ascending: false })
    .limit(limit);
  if (dateFrom) q = q.gte("recorded_at", `${dateFrom}T00:00:00`);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

const CAMPOS_STAFF = "id, name, role, rut, contact";
const CAMPOS_STAFF_FICHA = `${CAMPOS_STAFF}, email, emergency_name, emergency_phone, profile_id`;

export async function getStaff(buildingId: string): Promise<StaffRow[]> {
  const db = createServerClient();

  const completo = await db
    .from("staff")
    .select(CAMPOS_STAFF_FICHA)
    .eq("building_id", buildingId)
    .eq("active", true)
    .order("name");

  if (!completo.error) return (completo.data ?? []) as StaffRow[];

  // Igual que con el padrón: esta lista alimenta pantallas de operación
  // —turnos, asistencia, portería— y no puede caerse porque falte correr
  // `migration_v15_ficha_personal.sql`. Se pide lo de siempre y la ficha
  // queda vacía hasta que la migración exista.
  if (completo.error.code !== COLUMNA_INEXISTENTE) throw completo.error;

  const { data, error } = await db
    .from("staff")
    .select(CAMPOS_STAFF)
    .eq("building_id", buildingId)
    .eq("active", true)
    .order("name");
  if (error) throw error;

  return (data ?? []).map((s) => ({
    ...s,
    email: null,
    emergency_name: null,
    emergency_phone: null,
    profile_id: null,
  })) as StaffRow[];
}

export async function getAllShifts(buildingId: string, limit = 60): Promise<ShiftRow[]> {
  const db = createServerClient();
  const today = todayInChile();
  const { data, error } = await db
    .from("shifts")
    .select("id, date, type, start_time, end_time, location, status, staff(id, name, role, contact)")
    .eq("building_id", buildingId)
    .gte("date", today)
    .order("date")
    .order("start_time")
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as ShiftRow[];
}

export async function getTodayShifts(buildingId: string): Promise<ShiftRow[]> {
  const db = createServerClient();
  const today = todayInChile();

  const { data, error } = await db
    .from("shifts")
    .select("id, date, type, start_time, end_time, location, status, staff(id, name, role, contact)")
    .eq("building_id", buildingId)
    .eq("date", today)
    .order("start_time");

  if (error) throw error;
  return (data ?? []) as unknown as ShiftRow[];
}


/**
 * Cuál de los accesos usa más este edificio.
 *
 * El botón negro de la portería marcaba siempre "Visita" porque estaba escrito
 * así en el código. Pero un edificio de oficinas registra sobre todo
 * proveedores, y uno con mucho comercio electrónico, entregas: el destacado
 * tiene que salir de lo que ahí pasa, no de lo que supusimos.
 *
 * Solo compiten los tres accesos de ingreso. **La salida no entra**: su rojo
 * no es jerarquía, es significado, y pintarla de negro rompería la única señal
 * de color que tiene la pantalla. El escaneo tampoco: es confirmar un pase que
 * ya venía autorizado, no registrar a alguien nuevo.
 *
 * Treinta días: suficiente para reflejar cómo funciona el edificio, y
 * suficientemente largo para que el botón no cambie de color cada semana.
 */
export async function getTilePrincipal(buildingId: string): Promise<"visita" | "entrega" | "proveedor"> {
  const db = createServerClient();

  const { data, error } = await db
    .from("access_log")
    .select("type")
    .eq("building_id", buildingId)
    .gte("recorded_at", startOfDayUtc(daysAgoInChile(30)))
    .in("type", ["in", "delivery", "parcel", "provider"]);

  // Sin datos —o si algo falla— manda "Visita": es lo que más pasa en una
  // portería y es lo que el conserje espera encontrar en negro.
  if (error || !data || data.length === 0) return "visita";

  const cuenta = { visita: 0, entrega: 0, proveedor: 0 };
  for (const fila of data) {
    if (fila.type === "in") cuenta.visita++;
    else if (fila.type === "delivery" || fila.type === "parcel") cuenta.entrega++;
    else if (fila.type === "provider") cuenta.proveedor++;
  }

  // El empate lo gana Visita, por lo mismo: es el caso por defecto.
  if (cuenta.entrega > cuenta.visita && cuenta.entrega >= cuenta.proveedor) return "entrega";
  if (cuenta.proveedor > cuenta.visita && cuenta.proveedor > cuenta.entrega) return "proveedor";
  return "visita";
}

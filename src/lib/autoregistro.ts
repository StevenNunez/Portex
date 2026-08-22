import "server-only";
import { createServerClient as createServiceClient } from "@/lib/supabase-server";
import type { SolicitudPendiente } from "@/lib/autoregistro-tipos";
import { sendPushToProfiles } from "@/lib/push";

export type { SolicitudPendiente };

/**
 * El código del edificio: el cartel del ascensor.
 *
 * Un vecino escanea el QR, dice quién es y en qué departamento vive, y queda
 * esperando a que el conserje lo apruebe. Nada de esto crea una cuenta: hasta
 * que alguien de la portería diga que sí, una solicitud es un papelito.
 */

/**
 * Sin O/0, sin I/1/L, sin U (se confunde con V al dictar). El código también
 * se lee en voz alta por teléfono cuando la cámara no coopera, así que cada
 * carácter tiene que ser inconfundible dicho y escrito.
 */
const ALFABETO = "ABCDEFGHJKMNPQRSTVWXYZ23456789";
const LARGO = 8;

/** "K7M2Q4XP" → "K7M2-Q4XP": así se dicta y se tipea sin perderse. */
export function codigoLegible(codigo: string): string {
  return `${codigo.slice(0, 4)}-${codigo.slice(4)}`;
}

/** Acepta lo que sea que haya tecleado la persona: minúsculas, guiones, espacios. */
export function normalizarCodigo(crudo: string): string {
  return crudo.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function generarCodigo(): string {
  const bytes = new Uint8Array(LARGO);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ALFABETO[b % ALFABETO.length]).join("");
}

async function leerCodigo(buildingId: string): Promise<string | null> {
  const db = createServiceClient();
  const { data } = await db
    .from("buildings")
    .select("join_code")
    .eq("id", buildingId)
    .maybeSingle();
  return data?.join_code ?? null;
}

/**
 * El código del edificio, creándolo la primera vez.
 *
 * **Tiene que devolver siempre el mismo**, y ahí está toda la dificultad: el
 * código termina impreso y pegado en un ascensor. Si dos cargas de la página
 * de configuración caen a la vez —el administrador abre dos pestañas, o el
 * servidor de desarrollo renderiza dos veces— ambas ven la columna vacía,
 * ambas generan uno y la segunda pisa a la primera. El cartel que se imprimió
 * hace un minuto deja de servir.
 *
 * Por eso la escritura lleva `.is("join_code", null)`: gana quien llegue
 * primero, y el que llega después no pisa nada — lee el que ya está y lo
 * devuelve. Es la base la que decide, no el orden en que corrieron.
 */
export async function obtenerOCrearCodigo(buildingId: string): Promise<string | null> {
  const yaTiene = await leerCodigo(buildingId);
  if (yaTiene) return yaTiene;

  const db = createServiceClient();

  for (let intento = 0; intento < 5; intento++) {
    const codigo = generarCodigo();
    const { data: escrito, error } = await db
      .from("buildings")
      .update({ join_code: codigo, join_code_updated_at: new Date().toISOString() })
      .eq("id", buildingId)
      // Solo si sigue vacío: convierte esto en un "crear si no existe".
      .is("join_code", null)
      .select("join_code");

    if (!error && escrito && escrito.length > 0) return codigo;

    // Cero filas tocadas significa que otro se adelantó: su código es el
    // bueno. 23505 es la colisión —casi imposible en 30^8, pero un índice
    // único no perdona— y se reintenta con otro.
    if (!error) return leerCodigo(buildingId);
    if (error.code !== "23505") return null;
  }
  return null;
}

/** Genera uno nuevo. Los carteles impresos dejan de servir en el acto. */
export async function regenerarCodigo(buildingId: string): Promise<string | null> {
  const db = createServiceClient();
  await db.from("buildings").update({ join_code: null }).eq("id", buildingId);
  return obtenerOCrearCodigo(buildingId);
}

export interface EdificioPorCodigo {
  id: string;
  name: string;
  organizationId: string | null;
  /** Los departamentos que ya están en el padrón, para sugerirlos. */
  unidades: string[];
}

/** Qué edificio es este código, o null si no es de nadie. */
export async function edificioPorCodigo(codigoCrudo: string): Promise<EdificioPorCodigo | null> {
  const codigo = normalizarCodigo(codigoCrudo);
  if (codigo.length !== LARGO) return null;

  const db = createServiceClient();
  const { data: edificio } = await db
    .from("buildings")
    .select("id, name, organization_id")
    .eq("join_code", codigo)
    .maybeSingle();

  if (!edificio) return null;

  // Solo los códigos de unidad, nunca los nombres: esta página la ve
  // cualquiera que pase frente al ascensor, y el padrón de quién vive dónde
  // no es información de la calle.
  const { data: filas } = await db
    .from("residents")
    .select("unit_code")
    .eq("building_id", edificio.id)
    .order("unit_code");

  const unidades = [...new Set((filas ?? []).map((f) => f.unit_code))];

  return {
    id: edificio.id,
    name: edificio.name,
    organizationId: edificio.organization_id,
    unidades,
  };
}

/** Lo que la portería tiene por revisar. */
export async function solicitudesPendientes(buildingId: string): Promise<SolicitudPendiente[]> {
  const db = createServiceClient();

  const { data: filas, error } = await db
    .from("resident_signups")
    .select("id, unit_code, name, email, phone, created_at")
    .eq("building_id", buildingId)
    .eq("status", "pendiente")
    .order("created_at", { ascending: false });

  // La portería no puede quedarse en blanco porque falte la migración v14.
  if (error) return [];
  if (!filas || filas.length === 0) return [];

  const { data: padron } = await db
    .from("residents")
    .select("unit_code, name")
    .eq("building_id", buildingId)
    .in("unit_code", [...new Set(filas.map((f) => f.unit_code))]);

  const titular = new Map((padron ?? []).map((r) => [r.unit_code, r.name]));

  return filas.map((f) => ({
    id: f.id,
    unitCode: f.unit_code,
    name: f.name,
    email: f.email,
    phone: f.phone,
    createdAt: f.created_at,
    unidadConocida: titular.has(f.unit_code),
    titularEnPadron: titular.get(f.unit_code) ?? null,
  }));
}


/**
 * Le avisa a la portería que hay un vecino esperando.
 *
 * El conserje no está mirando la pantalla: está en la puerta, recibiendo una
 * encomienda o anotando una visita. Sin este aviso, una solicitud puede
 * quedarse horas ahí y el vecino se queda pensando que la app no funciona.
 *
 * Va a los conserjes **y** al administrador: en un condominio chico muchas
 * veces es la misma persona, y en uno grande el administrador quiere saber
 * que el cartel está funcionando.
 *
 * Nunca hace fallar la solicitud: si el aviso no sale —el conserje no activó
 * las notificaciones, o el navegador dejó de aceptar la suscripción—, el
 * vecino igual quedó anotado y la banda aparece igual en la pantalla.
 */
export async function avisarPorteriaDeSolicitud(
  buildingId: string,
  solicitud: { name: string; unitCode: string }
): Promise<void> {
  try {
    const db = createServiceClient();

    const { data: edificio } = await db
      .from("buildings")
      .select("organization_id")
      .eq("id", buildingId)
      .maybeSingle();

    if (!edificio?.organization_id) return;

    const { data: perfiles } = await db
      .from("profiles")
      .select("id")
      .eq("organization_id", edificio.organization_id)
      .in("role", ["conserje", "admin"]);

    const ids = (perfiles ?? []).map((p) => p.id);
    if (ids.length === 0) return;

    await sendPushToProfiles(ids, {
      title: "Un vecino pide acceso a la app",
      body: `${solicitud.name} · ${solicitud.unitCode}. Toca para confirmar si vive ahí.`,
      url: "/conserje",
      tag: "portex-solicitud",
      // Sin insistencia: no es una visita esperando en la puerta, puede
      // revisarse cuando el conserje tenga un minuto.
      requireInteraction: false,
    });
  } catch {
    /* el aviso es un extra; la solicitud ya quedó guardada */
  }
}

/** Cuántas solicitudes esperan. Es lo que consulta la portería cada tanto. */
export async function contarSolicitudesPendientes(buildingId: string): Promise<number> {
  const db = createServiceClient();
  const { count, error } = await db
    .from("resident_signups")
    .select("id", { count: "exact", head: true })
    .eq("building_id", buildingId)
    .eq("status", "pendiente");
  return error ? 0 : (count ?? 0);
}

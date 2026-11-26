import "server-only";

import { createHash } from "node:crypto";
import { createServerClient as createServiceClient } from "@/lib/supabase-server";
import { enviarAvisoDeError, smtpConfigurado } from "@/lib/email";

/**
 * El registro de errores (migration_v17).
 *
 * Todo error que Portex no supo resolver pasa por acá: queda en los registros
 * de Vercel (`console.error`), en la tabla `errores` agrupado por huella, y la
 * primera vez que aparece uno nuevo sale un aviso a Teo Labs.
 *
 * Nunca lanza: anotar un error no puede convertirse en un segundo error.
 */

export type ErrorAnotado = {
  origen: "navegador" | "servidor";
  /** Dónde pasó: la acción o la pantalla, p. ej. "accion addStaffMember". */
  donde: string;
  error: unknown;
  detalle?: Record<string, unknown>;
  usuarioId?: string | null;
  organizacionId?: string | null;
};

const AVISO_A = () =>
  process.env.AVISO_ERRORES_A?.trim() || process.env.ADMIN_EMAIL?.trim() || "hola@teolabs.app";

/** El texto del error sin lo que cambia de una vez a otra (ids, números, valores). */
function normalizar(mensaje: string) {
  return mensaje
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "<id>")
    .replace(/\b\d+([.,]\d+)*\b/g, "<n>")
    .replace(/"[^"]{0,200}"/g, '"…"')
    .trim()
    .slice(0, 500);
}

export function mensajeDe(error: unknown): string {
  if (error instanceof Error) return error.message || error.name;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export async function anotarError(e: ErrorAnotado): Promise<void> {
  try {
    const mensaje = mensajeDe(e.error).slice(0, 2000);
    const pila =
      e.error instanceof Error ? e.error.stack?.split("\n").slice(0, 8).join("\n") : undefined;
    const entorno = process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "desconocido";

    console.error(`[error ${e.origen}] ${e.donde}: ${mensaje}`, pila ?? "");

    const huella = createHash("sha256")
      .update(`${e.origen}|${e.donde}|${normalizar(mensaje)}`)
      .digest("hex")
      .slice(0, 32);

    const db = createServiceClient();
    const { data: esNuevo, error } = await db.rpc("registrar_error", {
      p_huella: huella,
      p_origen: e.origen,
      p_donde: e.donde.slice(0, 300),
      p_mensaje: mensaje,
      p_detalle: { ...e.detalle, ...(pila ? { pila } : {}), entorno },
      p_usuario_id: e.usuarioId ?? null,
      p_organizacion_id: e.organizacionId ?? null,
    });

    // Sin la v17 aplicada, el error igual quedó en los registros de Vercel.
    if (error) {
      console.error("[error] No se pudo anotar en la tabla errores:", error.message);
      return;
    }

    // Solo desde producción: probando en localhost no se llena la casilla.
    if (esNuevo === true && entorno === "production" && smtpConfigurado()) {
      await enviarAvisoDeError({
        to: AVISO_A(),
        donde: e.donde,
        mensaje,
        filas: [
          ["Dónde", e.donde],
          ["Origen", e.origen === "navegador" ? "Pantalla (navegador)" : "Servidor"],
          ["Organización", e.organizacionId ?? "—"],
          ["Usuario", e.usuarioId ?? "—"],
          ["Huella", huella],
        ],
      }).catch((x) => console.error("[error] No se pudo avisar por correo:", mensajeDe(x)));
    }
  } catch (x) {
    console.error("[error] Falló el registro de errores:", mensajeDe(x));
  }
}

/**
 * Para las acciones del servidor: anota el error y devuelve qué decirle a la
 * persona. El mensaje técnico (en inglés, de Postgres o de Supabase) queda en
 * el registro; a la pantalla va una frase en castellano que dice qué hacer.
 *
 *   if (error) return { ok: false, error: await fallo("addResident", error) };
 */
export async function fallo(
  donde: string,
  error: unknown,
  quien?: { usuarioId?: string | null; organizacionId?: string | null }
): Promise<string> {
  const { mensaje, esperable } = explicarErrorServidor(error);
  if (!esperable) {
    await anotarError({
      origen: "servidor",
      donde: `accion ${donde}`,
      error,
      usuarioId: quien?.usuarioId,
      organizacionId: quien?.organizacionId,
    });
  }
  return mensaje;
}

/**
 * El proveedor de correo (o Supabase) cortó por cantidad: SMTP 421/450/452,
 * cuota diaria de Zoho/Brevo, o el freno por hora. No es un error del código,
 * así que no se anota; la invitación masiva lo usa para detenerse a tiempo.
 */
export const LIMITE_DE_ENVIO = "Se alcanzó el límite de envíos del proveedor de correo.";

export function esLimiteDeEnvio(texto: string): boolean {
  return (
    texto.includes(LIMITE_DE_ENVIO) ||
    /rate limit|too many|429|over_email_send_rate|quota|daily limit|sending limit|not allowed to send/i.test(texto) ||
    /\b(421|450|452)[\s-]/.test(texto)
  );
}

type Regla = { si: RegExp; mensaje: string; esperable?: boolean };

/**
 * Los errores que sabemos explicar. Los `esperable` son del uso normal (un RUT
 * que ya está cargado): no se anotan, porque no hay nada que arreglar.
 */
const REGLAS: Regla[] = [
  {
    si: /duplicate key|already exists|23505/i,
    mensaje: "Ya existe un registro con esos mismos datos. Revisa que no lo hayas cargado antes.",
    esperable: true,
  },
  {
    si: /fetch failed|ECONNRESET|ETIMEDOUT|ENOTFOUND|network/i,
    mensaje: "No pudimos conectarnos con la base de datos. Prueba de nuevo en unos segundos.",
  },
  {
    si: /statement timeout|canceling statement|timed out|\b(502|503|504|520|522|524)\b/i,
    mensaje: "La base de datos tardó más de lo normal en responder. Prueba de nuevo en unos segundos.",
  },
  {
    si: /row-level security|permission denied|42501|insufficient privilege/i,
    mensaje: "Tu cuenta no tiene permiso para hacer esto. Pídeselo al administrador del edificio.",
  },
  {
    si: /is still referenced|update or delete on table/i,
    mensaje: "No se puede borrar porque hay otros registros que dependen de este.",
    esperable: true,
  },
  {
    si: /is not present in table|violates foreign key/i,
    mensaje: "Uno de los datos elegidos ya no existe. Recarga la página y vuelve a elegirlo.",
  },
  {
    si: /null value in column|violates not-null|23502/i,
    mensaje: "Falta completar un dato obligatorio.",
    esperable: true,
  },
  {
    si: /violates check constraint|23514|invalid input syntax|22P02|22007|22008/i,
    mensaje: "Uno de los valores no tiene el formato correcto. Revísalo y vuelve a intentar.",
    esperable: true,
  },
  {
    si: /schema cache|does not exist|could not find the|PGRST20[0-9]|42P01|42703|42883/i,
    mensaje: "Falta aplicar una actualización de la base de datos. Ya avisamos a Teo Labs.",
  },
];

const GENERICO = "Algo no salió bien. Prueba de nuevo y, si sigue pasando, avísanos: ya quedó registrado.";

function explicarErrorServidor(error: unknown): { mensaje: string; esperable: boolean } {
  const texto = mensajeDe(error);
  if (esLimiteDeEnvio(texto)) return { mensaje: LIMITE_DE_ENVIO, esperable: true };
  for (const r of REGLAS) {
    if (r.si.test(texto)) return { mensaje: r.mensaje, esperable: Boolean(r.esperable) };
  }
  return { mensaje: GENERICO, esperable: false };
}

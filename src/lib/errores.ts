"use client";

import { createSupabaseBrowser } from "@/lib/supabase-browser";

/**
 * Los errores, del lado de la pantalla.
 *
 *   mensajeParaPersona(e, donde)  lo que se le muestra al conserje, al
 *                                 administrador o al residente: en castellano
 *                                 y diciendo qué hacer. Lo que no sabe
 *                                 explicar, además, lo reporta.
 *   reportarError(donde, e)       manda el error al registro (/api/errores),
 *                                 sin esperar respuesta y sin lanzar nunca.
 *
 * Los mensajes que escribimos nosotros («Esa unidad no es de este edificio»)
 * pasan tal cual: solo se traduce lo que viene en inglés del navegador, de
 * Postgres o de Supabase.
 */

export function textoDeError(e: unknown): string {
  if (e instanceof Error) return e.message || e.name;
  if (typeof e === "string") return e;
  if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
  return String(e);
}

type Regla = {
  si: RegExp;
  mensaje: string;
  /** Vale la pena que Teo Labs se entere (no es algo esperable del uso). */
  reportar?: boolean;
};

const REGLAS: Regla[] = [
  {
    si: /failed to fetch|networkerror|network request failed|load failed|fetch failed|err_internet_disconnected/i,
    mensaje: "No se pudo conectar. Revisa la conexión a internet y vuelve a intentar.",
  },
  {
    si: /jwt expired|invalid jwt|refresh token|session.*(expired|missing)|not authenticated|no autenticado/i,
    mensaje: "Tu sesión expiró. Vuelve a ingresar para seguir.",
  },
  {
    si: /invalid login credentials/i,
    mensaje: "El correo o la contraseña no coinciden.",
  },
  {
    si: /email not confirmed/i,
    mensaje: "Todavía no confirmas tu correo. Revisa tu bandeja de entrada (y la de spam).",
  },
  {
    si: /user already registered|already been registered/i,
    mensaje: "Ya hay una cuenta con ese correo. Ingresa con ella o recupera tu contraseña.",
  },
  {
    si: /password should be at least|weak password|password is too weak/i,
    mensaje: "La contraseña es muy débil. Usa al menos 8 caracteres, mezclando letras y números.",
  },
  {
    si: /should be different from the old password/i,
    mensaje: "La contraseña nueva tiene que ser distinta de la anterior.",
  },
  {
    si: /rate limit|too many requests|429|for security purposes, you can only/i,
    mensaje: "Hiciste muchos intentos seguidos. Espera un minuto y vuelve a probar.",
  },
  {
    si: /unable to validate email|invalid email|email address .* is invalid/i,
    mensaje: "Ese correo no parece válido. Revisa que esté bien escrito.",
  },
  {
    si: /statement timeout|canceling statement|timed out|\b(502|503|504|520|522|524)\b/i,
    mensaje: "El servidor tardó más de lo normal en responder. Prueba de nuevo en unos segundos.",
    reportar: true,
  },
  {
    si: /row-level security|permission denied|42501|insufficient privilege/i,
    mensaje: "Tu cuenta no tiene permiso para hacer esto. Pídeselo al administrador del edificio.",
  },
  {
    si: /duplicate key|already exists|23505/i,
    mensaje: "Ya existe un registro con esos mismos datos. Revisa que no lo hayas cargado antes.",
  },
  {
    si: /server action .* not found|failed to find server action/i,
    mensaje: "Portex se actualizó mientras tenías la pantalla abierta. Recarga la página para seguir.",
  },
];

/** Inglés técnico que no escribimos nosotros: si no calza ninguna regla, mejor no mostrarlo crudo. */
const EN_INGLES =
  /\b(error|failed|violates|column|relation|function|syntax|invalid|unexpected|cannot|undefined|null|exception|unknown|denied|constraint|is not|server)\b/i;
const CASTELLANO = /[áéíóúñ¿¡]|\b(no se|el|la|los|las|de|para|una?|que|ya|falta|tu)\b/i;

const GENERICO = "Algo no salió bien. Prueba de nuevo y, si sigue pasando, avísanos: ya quedó registrado.";

/** Qué decirle a la persona y si conviene reportarlo. Sin efectos: se puede llamar al dibujar. */
export function explicarError(e: unknown): { mensaje: string; reportar: boolean } {
  const texto = textoDeError(e);
  for (const r of REGLAS) {
    if (r.si.test(texto)) return { mensaje: r.mensaje, reportar: Boolean(r.reportar) };
  }
  if (!texto.trim() || (EN_INGLES.test(texto) && !CASTELLANO.test(texto))) {
    return { mensaje: GENERICO, reportar: true };
  }
  return { mensaje: texto, reportar: false };
}

/** Para mostrar en pantalla al atrapar un error: lo explica y, si hace falta, lo reporta. */
export function mensajeParaPersona(e: unknown, donde = "pantalla"): string {
  const { mensaje, reportar } = explicarError(e);
  if (reportar) reportarError(donde, e);
  return mensaje;
}

/* El mismo error de la misma pantalla se reporta una vez por sesión del navegador. */
const yaReportados = new Set<string>();

export function reportarError(donde: string, e: unknown) {
  if (typeof window === "undefined") return;
  const mensaje = textoDeError(e).slice(0, 2000);
  const clave = `${donde}|${mensaje}`;
  if (yaReportados.has(clave) || yaReportados.size > 200) return;
  yaReportados.add(clave);

  void (async () => {
    try {
      const { data } = await createSupabaseBrowser().auth.getSession();
      const token = data.session?.access_token;
      await fetch("/api/errores", {
        method: "POST",
        keepalive: true,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          donde,
          mensaje,
          pila: e instanceof Error ? e.stack?.slice(0, 4000) : undefined,
          pagina: window.location.pathname,
        }),
      });
    } catch {
      // Sin conexión no hay cómo avisar; no vale la pena reintentar.
    }
  })();
}

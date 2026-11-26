"use client";

import { useEffect } from "react";
import { reportarError } from "@/lib/errores";

/**
 * Lo que se ve cuando una pantalla de Portex se rompe. La usan `app/error.tsx`
 * (cualquier página) y `app/global-error.tsx` (cuando falla hasta el layout).
 *
 * El caso más común no es un fallo del código sino un deploy nuevo: la tablet
 * de la portería o el teléfono del residente tenía la app abierta con archivos
 * de la versión anterior, que ya no existen en el servidor. Recargar lo
 * arregla, así que en ese caso se recarga sola, una única vez (si vuelve a
 * fallar al minuto, muestra el aviso en vez de entrar en un bucle) y no se
 * reporta: no hay nada que arreglar.
 *
 * Los colores van escritos y no con `var(--px-…)`: `global-error` reemplaza
 * al layout y no carga `globals.css`.
 */

const CLAVE = "portex:recarga-por-error";

function esVersionVieja(error: unknown): boolean {
  const e = error as Error | null;
  const texto = `${e?.name ?? ""} ${e?.message ?? ""}`;
  return /ChunkLoadError|Loading chunk|Failed to load chunk|dynamically imported module|Importing a module script failed|server action .* not found|Failed to find Server Action/i.test(
    texto
  );
}

export default function PantallaDeError({
  error,
  retry,
  donde,
}: {
  error: unknown;
  retry: () => void;
  donde: string;
}) {
  const vieja = esVersionVieja(error);

  useEffect(() => {
    console.error(error);
    if (!vieja) {
      reportarError(`${donde} ${window.location.pathname}`, error);
      return;
    }
    try {
      const ultima = Number(window.sessionStorage.getItem(CLAVE) ?? 0);
      if (Date.now() - ultima < 60_000) return; // Ya se intentó hace poco: no repetir.
      window.sessionStorage.setItem(CLAVE, String(Date.now()));
    } catch {
      return; // Sin almacenamiento, mejor no recargar a ciegas.
    }
    window.location.reload();
  }, [error, vieja, donde]);

  return (
    <main
      style={{
        minHeight: "70svh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        fontFamily: "var(--font-inter-tight), system-ui, sans-serif",
        color: "#1E1B17",
      }}
    >
      <div
        role="alert"
        style={{
          width: "100%",
          maxWidth: 380,
          background: "#ffffff",
          border: "1px solid #ECEAE5",
          borderRadius: 16,
          padding: "28px 24px",
          textAlign: "center",
        }}
      >
        <h1 style={{ margin: 0, fontSize: 19, fontWeight: 700, letterSpacing: "-0.03em" }}>
          {vieja ? "Hay una versión nueva de Portex" : "No pudimos cargar esta pantalla"}
        </h1>
        <p style={{ margin: "10px 0 0", fontSize: 15, lineHeight: 1.55, color: "#5A5652" }}>
          {vieja
            ? "Portex se actualizó mientras tenías la pantalla abierta. Recarga para seguir."
            : "Puede ser algo pasajero. Reintenta y, si sigue igual, recarga la página. Ya nos llegó el aviso."}
        </p>
        <div style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 10 }}>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              minHeight: 48,
              borderRadius: 10,
              border: "none",
              background: "#1E1B17",
              color: "#F9F7F4",
              fontSize: 15,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Recargar
          </button>
          {!vieja && (
            <button
              type="button"
              onClick={() => retry()}
              style={{
                minHeight: 48,
                borderRadius: 10,
                border: "1px solid #D9D6D0",
                background: "transparent",
                color: "#1E1B17",
                fontSize: 15,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Reintentar
            </button>
          )}
          <a
            href="/inicio"
            style={{ marginTop: 4, fontSize: 14, color: "#5A5652", textDecoration: "underline" }}
          >
            Volver al inicio
          </a>
        </div>
      </div>
    </main>
  );
}

"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { aprobarSolicitud, rechazarSolicitud } from "@/app/autoregistro-actions";
import type { SolicitudPendiente } from "@/lib/autoregistro-tipos";

/**
 * Los vecinos que escanearon el cartel y esperan que la portería confirme.
 *
 * El conserje es el único que sabe quién vive en el 1204, y por eso aprueba
 * él: el código está pegado en un ascensor, cualquiera puede pedir. Esta
 * pantalla existe para que decidir sea un vistazo, no una investigación —
 * por eso lo primero que se ve es si el departamento existe en el padrón y
 * a nombre de quién está.
 */

const MONO: CSSProperties = {
  fontFamily: "var(--font-jetbrains-mono)",
  fontSize: 10.5,
  letterSpacing: "0.08em",
  color: "var(--px-mid)",
};

function haceCuanto(iso: string): string {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1)  return "recién";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24)   return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? "ayer" : `hace ${d} días`;
}

export default function SolicitudesDrawer({
  open,
  onClose,
  solicitudes,
}: {
  open: boolean;
  onClose: () => void;
  solicitudes: SolicitudPendiente[];
}) {
  const router = useRouter();
  const [trabajando, setTrabajando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hechas, setHechas] = useState<Record<string, "aprobada" | "rechazada">>({});

  async function aprobar(s: SolicitudPendiente) {
    if (trabajando) return;
    setTrabajando(s.id);
    setError(null);
    const res = await aprobarSolicitud({ id: s.id });
    if (!res.ok) {
      setError(res.error ?? "No se pudo aprobar");
      setTrabajando(null);
      return;
    }
    setHechas((h) => ({ ...h, [s.id]: "aprobada" }));
    setTrabajando(null);
    router.refresh();
  }

  async function rechazar(s: SolicitudPendiente) {
    if (trabajando) return;
    setTrabajando(s.id);
    setError(null);
    const res = await rechazarSolicitud({ id: s.id });
    if (!res.ok) {
      setError(res.error ?? "No se pudo rechazar");
      setTrabajando(null);
      return;
    }
    setHechas((h) => ({ ...h, [s.id]: "rechazada" }));
    setTrabajando(null);
    router.refresh();
  }

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 40,
          background: "rgba(20,15,8,0.45)",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition: "opacity 0.2s",
        }}
      />

      <div
        style={{
          position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50,
          background: "var(--px-bone)",
          borderRadius: "22px 22px 0 0",
          padding: "0 clamp(16px, 5vw, 28px) calc(32px + env(safe-area-inset-bottom, 0px))",
          maxHeight: "88dvh",
          transform: open ? "translateY(0)" : "translateY(100%)",
          transition: "transform 0.26s cubic-bezier(0.4,0,0.2,1)",
          display: "flex", flexDirection: "column",
          boxShadow: "0 -8px 40px rgba(0,0,0,0.14)",
        }}
      >
        <div style={{ padding: "22px 0 16px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexShrink: 0 }}>
          <div>
            <div style={MONO}>PIDEN ACCESO A LA APP</div>
            <div style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.025em", marginTop: 3 }}>
              {solicitudes.length === 1 ? "Un vecino" : `${solicitudes.length} vecinos`}
            </div>
            <div style={{ fontSize: 14, color: "var(--px-mid)", marginTop: 4, maxWidth: 460, lineHeight: 1.5 }}>
              Escanearon el cartel del edificio. Aprueba solo a quien reconozcas: hasta
              que lo hagas, no existe ninguna cuenta.
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            style={{
              background: "none", border: "none", cursor: "pointer", color: "var(--px-mid)",
              padding: 8, borderRadius: 8, flexShrink: 0,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M3 3l10 10M13 3L3 13" />
            </svg>
          </button>
        </div>

        {error && (
          <div
            style={{
              background: "oklch(0.96 0.05 28)", border: "1px solid oklch(0.88 0.12 28)",
              borderRadius: 10, padding: "11px 15px", marginBottom: 14,
              fontSize: 14, color: "oklch(0.40 0.18 28)", flexShrink: 0,
            }}
          >
            {error}
          </div>
        )}

        <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column", gap: 10, paddingBottom: 8 }}>
          {solicitudes.map((s) => {
            const hecha = hechas[s.id];
            const ocupado = trabajando === s.id;

            return (
              <div
                key={s.id}
                style={{
                  background: "white",
                  border: `1px solid ${hecha === "aprobada" ? "var(--px-ok)" : "var(--px-line)"}`,
                  borderRadius: 16,
                  padding: "16px 18px",
                  opacity: hecha === "rechazada" ? 0.5 : 1,
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
                      <span style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 15, fontWeight: 700 }}>
                        {s.unitCode}
                      </span>
                      {s.unidadConocida ? (
                        <span
                          style={{
                            fontFamily: "var(--font-jetbrains-mono)", fontSize: 9.5, letterSpacing: "0.06em",
                            padding: "3px 7px", borderRadius: 5,
                            color: "oklch(0.42 0.12 150)", background: "oklch(0.95 0.05 150)",
                          }}
                        >
                          EN EL PADRÓN
                        </span>
                      ) : (
                        <span
                          style={{
                            fontFamily: "var(--font-jetbrains-mono)", fontSize: 9.5, letterSpacing: "0.06em",
                            padding: "3px 7px", borderRadius: 5,
                            color: "oklch(0.48 0.14 75)", background: "oklch(0.95 0.06 75)",
                          }}
                        >
                          UNIDAD NUEVA
                        </span>
                      )}
                      <span style={{ ...MONO, fontSize: 10 }}>{haceCuanto(s.createdAt)}</span>
                    </div>

                    <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.02em", marginTop: 6 }}>
                      {s.name}
                    </div>

                    <div style={{ fontSize: 13.5, color: "var(--px-mid)", marginTop: 2, wordBreak: "break-all" }}>
                      {s.email}
                      {s.phone ? ` · ${s.phone}` : ""}
                    </div>

                    {/* Lo que le permite decidir sin levantarse: a nombre de
                        quién está esa unidad, o que todavía no está. */}
                    <div style={{ fontSize: 13, color: "var(--px-ink2)", marginTop: 8, lineHeight: 1.5 }}>
                      {s.titularEnPadron
                        ? <>En el padrón, el {s.unitCode} figura como <strong style={{ fontWeight: 600 }}>{s.titularEnPadron}</strong>.</>
                        : <>El {s.unitCode} todavía no está en el padrón. Si apruebas, se crea con este nombre.</>}
                    </div>
                  </div>

                  {!hecha && (
                    <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                      <button
                        onClick={() => rechazar(s)}
                        disabled={ocupado}
                        style={{
                          padding: "12px 16px", background: "transparent",
                          border: "1px solid var(--px-line)", borderRadius: 12,
                          font: "inherit", fontSize: 14, color: "var(--px-mid)",
                          cursor: ocupado ? "default" : "pointer",
                        }}
                      >
                        No vive acá
                      </button>
                      <button
                        onClick={() => aprobar(s)}
                        disabled={ocupado}
                        style={{
                          padding: "12px 20px", background: "var(--px-ok)", color: "white",
                          border: "none", borderRadius: 12,
                          font: "inherit", fontSize: 15, fontWeight: 600,
                          cursor: ocupado ? "default" : "pointer",
                        }}
                      >
                        {ocupado ? "Un momento…" : "Aprobar"}
                      </button>
                    </div>
                  )}

                  {hecha === "aprobada" && (
                    <div style={{ fontSize: 13.5, color: "oklch(0.42 0.12 150)", flexShrink: 0, maxWidth: 200, lineHeight: 1.5 }}>
                      ✓ Aprobado. Le llegó el correo para crear su contraseña.
                    </div>
                  )}
                  {hecha === "rechazada" && (
                    <div style={{ fontSize: 13.5, color: "var(--px-mid)", flexShrink: 0 }}>
                      Rechazada
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {solicitudes.length === 0 && (
            <div style={{ padding: "40px 0", textAlign: "center", color: "var(--px-mid)", fontSize: 14 }}>
              No hay solicitudes esperando.
            </div>
          )}
        </div>
      </div>
    </>
  );
}

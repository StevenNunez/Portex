"use client";

import { useEffect, useRef, useState } from "react";
import { markAttendanceByRut, type MarcaResult } from "@/app/asistencia-actions";
import { formatRutInput, normalizeRut } from "@/lib/rut";
import { useFocusOnOpen, useResetOnOpen } from "@/lib/drawer";

/**
 * Marcaje de asistencia del personal.
 *
 * Lo usa el jardinero, la señora del aseo, el maestro: gente que no tiene
 * cuenta ni clave y que muchas veces llega con las manos ocupadas. Por eso
 * el teclado es de números grandes y el gesto es uno solo — el sistema sabe
 * si esta persona está entrando o saliendo, nadie tiene que elegir el botón
 * correcto a las seis de la mañana.
 */

export interface PresentStaff {
  id: string;
  name: string;
  role: string;
  since: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  present: PresentStaff[];
  onMarked: (res: MarcaResult) => void;
}

const DRAWER: React.CSSProperties = {
  position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50,
  background: "var(--px-bone)", borderRadius: "24px 24px 0 0",
  padding: "0 28px 36px", maxHeight: "88dvh",
  display: "flex", flexDirection: "column",
};

const MONO: React.CSSProperties = {
  fontFamily: "var(--font-jetbrains-mono)",
  fontSize: 10, letterSpacing: "0.08em", color: "var(--px-mid)",
};

const TECLAS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "K", "0", "←"];

function hora(iso: string) {
  return new Date(iso).toLocaleTimeString("es-CL", {
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
}

function duracion(minutos: number) {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export default function AsistenciaDrawer({ open, onClose, present, onMarked }: Props) {
  const [rut, setRut] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MarcaResult | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  useResetOnOpen(open, () => {
    setRut("");
    setSaving(false);
    setError(null);
    setResult(null);
  });
  useFocusOnOpen(open, inputRef);

  // La pantalla de resultado se lee y se va sola: atrás viene el siguiente.
  useEffect(() => {
    if (!result) return;
    const id = setTimeout(onClose, 4000);
    return () => clearTimeout(id);
  }, [result, onClose]);

  const puedeMarcar = normalizeRut(rut).length >= 7 && !saving;

  function tecla(t: string) {
    setError(null);
    if (t === "←") {
      setRut((prev) => formatRutInput(normalizeRut(prev).slice(0, -1)));
      return;
    }
    setRut((prev) => formatRutInput(normalizeRut(prev) + t));
  }

  async function marcar() {
    if (!puedeMarcar) return;
    setSaving(true);
    setError(null);

    const res = await markAttendanceByRut(rut);
    setSaving(false);

    if (!res.ok) {
      setError(res.error ?? "No se pudo marcar. Intenta de nuevo.");
      return;
    }

    setResult(res);
    onMarked(res);
  }

  const entrada = result?.action === "entrada";
  const atrasado = (result?.lateMinutes ?? 0) > 0;

  return (
    <>
      <div style={{ position: "fixed", inset: 0, background: "rgba(20,15,8,0.45)", zIndex: 40, opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none", transition: "opacity 0.2s" }} />
      <div style={{ ...DRAWER, transform: open ? "translateY(0)" : "translateY(100%)", transition: "transform 0.28s cubic-bezier(0.32, 0.72, 0, 1)", boxShadow: "0 -4px 40px -8px rgba(20,15,8,0.25)" }}>

        <div style={{ position: "absolute", top: 10, left: "50%", transform: "translateX(-50%)", width: 40, height: 4, borderRadius: 2, background: "var(--px-line)" }} />

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 22, paddingBottom: 18, flexShrink: 0 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em" }}>
              {result ? "" : "Marcar asistencia"}
            </h2>
            {!result && (
              <div style={{ fontSize: 13.5, color: "var(--px-mid)", marginTop: 3 }}>
                Personal del edificio · tu RUT marca entrada o salida
              </div>
            )}
          </div>
          <button onClick={onClose} style={{ background: "var(--px-paper)", border: "1px solid var(--px-line)", borderRadius: 20, width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--px-mid)", fontSize: 18, flexShrink: 0 }}>×</button>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>

          {/* ── Resultado ─────────────────────────────────────────── */}
          {result ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, textAlign: "center", padding: "20px 0 32px" }}>
              <div
                style={{
                  width: 72, height: 72, borderRadius: 36,
                  background: entrada ? "var(--px-ok)" : "var(--px-ink)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                <svg viewBox="0 0 24 24" width={32} height={32} fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 13l4 4L19 7" />
                </svg>
              </div>

              <div>
                <div style={{ fontSize: 30, fontWeight: 600, letterSpacing: "-0.03em", lineHeight: 1.1 }}>
                  {entrada ? `Bienvenido, ${result.staffName?.split(" ")[0]}` : `Hasta luego, ${result.staffName?.split(" ")[0]}`}
                </div>
                <div style={{ fontSize: 16, color: "var(--px-ink2)", marginTop: 8 }}>
                  {entrada ? "Entrada" : "Salida"} registrada a las{" "}
                  <strong style={{ fontFamily: "var(--font-jetbrains-mono)" }}>{result.at ? hora(result.at) : ""}</strong>
                  {result.role ? ` · ${result.role}` : ""}
                </div>
              </div>

              {/* El atraso se dice, no se esconde: es el dato por el que el
                  administrador puso el módulo. */}
              {entrada && result.shiftLabel && (
                <div
                  style={{
                    padding: "10px 18px", borderRadius: 999,
                    background: atrasado ? "oklch(0.95 0.05 28)" : "oklch(0.95 0.05 150)",
                    border: `1px solid ${atrasado ? "var(--px-alert)" : "var(--px-ok)"}`,
                    color: atrasado ? "var(--px-alert)" : "oklch(0.42 0.12 150)",
                    fontSize: 14.5, fontWeight: 500,
                  }}
                >
                  {atrasado
                    ? `${duracion(result.lateMinutes!)} de atraso · turno ${result.shiftLabel}`
                    : `Puntual · turno ${result.shiftLabel}`}
                </div>
              )}

              {!entrada && result.workedMinutes != null && (
                <div style={{ padding: "10px 18px", borderRadius: 999, background: "white", border: "1px solid var(--px-line)", fontSize: 14.5 }}>
                  Jornada de <strong>{duracion(result.workedMinutes)}</strong>
                  {result.earlyLeaveMinutes
                    ? ` · ${duracion(result.earlyLeaveMinutes)} antes de que terminara su turno`
                    : ""}
                </div>
              )}

              {result.cerroJornadaOlvidada && (
                <div style={{ fontSize: 13, color: "var(--px-mid)", maxWidth: 380, lineHeight: 1.5 }}>
                  Tu jornada anterior había quedado sin salida marcada: se cerró para poder
                  registrar la de hoy. El administrador puede corregir la hora.
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 24, alignItems: "start" }}>

              {/* ── RUT + teclado ─────────────────────────────────── */}
              <div>
                <div style={{ ...MONO, marginBottom: 8 }}>SU RUT, POR FAVOR</div>
                <input
                  ref={inputRef}
                  value={rut}
                  onChange={(e) => { setRut(formatRutInput(e.target.value)); setError(null); }}
                  onKeyDown={(e) => { if (e.key === "Enter") marcar(); }}
                  placeholder="12.345.678-9"
                  inputMode="numeric"
                  maxLength={12}
                  style={{
                    width: "100%", padding: "18px 22px",
                    fontFamily: "var(--font-jetbrains-mono)", fontSize: 32,
                    letterSpacing: "0.04em", textAlign: "center",
                    background: "white", border: "1px solid var(--px-line)",
                    borderRadius: 14, outline: "none", color: "var(--px-ink)",
                  }}
                />

                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 12 }}>
                  {TECLAS.map((t) => (
                    <button
                      key={t}
                      onClick={() => tecla(t)}
                      style={{
                        padding: "16px 0", background: "white",
                        border: "1px solid var(--px-line)", borderRadius: 12,
                        fontFamily: "var(--font-jetbrains-mono)", fontSize: 22,
                        color: t === "←" ? "var(--px-mid)" : "var(--px-ink)",
                        cursor: "pointer",
                      }}
                    >
                      {t}
                    </button>
                  ))}
                </div>

                {error && (
                  <div style={{ marginTop: 12, padding: "11px 14px", borderRadius: 10, background: "oklch(0.96 0.05 28)", border: "1px solid oklch(0.88 0.12 28)", color: "var(--px-alert)", fontSize: 14 }}>
                    {error}
                  </div>
                )}

                <button
                  onClick={marcar}
                  disabled={!puedeMarcar}
                  style={{
                    width: "100%", marginTop: 12, padding: "18px",
                    background: puedeMarcar ? "var(--px-ink)" : "var(--px-line)",
                    color: "var(--px-bone)", border: "none", borderRadius: 14,
                    font: "inherit", fontSize: 18, fontWeight: 600,
                    cursor: puedeMarcar ? "pointer" : "not-allowed",
                  }}
                >
                  {saving ? "Marcando…" : "Marcar"}
                </button>
              </div>

              {/* ── Quién está adentro ────────────────────────────── */}
              <div style={{ background: "white", border: "1px solid var(--px-line)", borderRadius: 14, padding: "14px 16px" }}>
                <div style={{ ...MONO, marginBottom: 10 }}>
                  EN EL EDIFICIO · {present.length}
                </div>
                {present.length === 0 ? (
                  <div style={{ fontSize: 13.5, color: "var(--px-mid)", lineHeight: 1.5 }}>
                    Nadie del personal tiene jornada abierta ahora.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {present.map((p) => (
                      <div key={p.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                          <div style={{ ...MONO }}>{p.role.toUpperCase()}</div>
                        </div>
                        <div style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 12, color: "var(--px-ink2)", flexShrink: 0 }}>
                          {hora(p.since)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

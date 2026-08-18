"use client";

import { useState, useEffect, useRef } from "react";
import { registerEntry } from "@/app/actions";
import { IconSearch } from "@/components/icons";
import { useFocusOnOpen, useResetOnOpen } from "@/lib/drawer";
import type { ActivityItem } from "@/lib/mock-data";

interface Props {
  open: boolean;
  onClose: () => void;
  onRegistered: (item: ActivityItem) => void;
  recentActivity: ActivityItem[];
}

function nowTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function initials(name: string) {
  return name.split(" ").slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

const SKIP_CTX = new Set(["Inicio de turno", "Fin de turno"]);

const DRAWER: React.CSSProperties = {
  position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50,
  background: "var(--px-bone)", borderRadius: "24px 24px 0 0",
  padding: "0 28px 36px", maxHeight: "80dvh",
  display: "flex", flexDirection: "column",
};

export default function SalidaDrawer({ open, onClose, onRegistered, recentActivity }: Props) {
  const [query, setQuery]       = useState("");
  const [selected, setSelected] = useState<ActivityItem | null>(null);
  const [saving, setSaving]     = useState(false);
  const [success, setSuccess]   = useState(false);
  const [manualName, setManualName] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);

  useResetOnOpen(open, () => {
    setQuery(""); setSelected(null); setSaving(false); setSuccess(false); setManualName("");
  });
  useFocusOnOpen(open, inputRef);

  useEffect(() => {
    if (success) {
      const id = setTimeout(onClose, 1800);
      return () => clearTimeout(id);
    }
  }, [success, onClose]);

  // Build a map of the most-recent event direction per person (activity is DESC).
  // First occurrence = most recent. If it's "out", they've already left.
  const latestDir = new Map<string, string>();
  for (const a of recentActivity) {
    const key = `${a.who}||${a.unit}`;
    if (!latestDir.has(key)) latestDir.set(key, a.dir);
  }

  const entradas = recentActivity.filter(
    (a) =>
      a.dir === "in" &&
      !SKIP_CTX.has(a.ctx) &&
      latestDir.get(`${a.who}||${a.unit}`) === "in"
  );

  const q = query.trim().toLowerCase();
  const filtered = q
    ? entradas.filter((a) => a.who.toLowerCase().includes(q) || a.unit.toLowerCase().includes(q))
    : entradas;

  const whoToRegister = selected?.who ?? manualName.trim();

  async function handleConfirm() {
    if (!whoToRegister) return;
    setSaving(true);
    try {
      const result = await registerEntry({
        type: "out",
        who: whoToRegister,
        context: "Salida",
        unit: selected?.unit || undefined,
        plate: selected?.plate || undefined,
      });
      onRegistered({
        id: result.id,
        t: new Date(result.recorded_at).toLocaleTimeString("es-CL", { timeZone: "America/Santiago", hour: "2-digit", minute: "2-digit", hour12: false }),
        dir: "out",
        who: result.who,
        ctx: "Salida",
        unit: result.unit ?? "",
        plate: result.plate,
        by: result.recorded_by ?? "",
      });
      setSuccess(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div style={{ position: "fixed", inset: 0, background: "rgba(20,15,8,0.45)", zIndex: 40, opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none", transition: "opacity 0.2s" }} />
      <div style={{ ...DRAWER, transform: open ? "translateY(0)" : "translateY(100%)", transition: "transform 0.28s cubic-bezier(0.32, 0.72, 0, 1)", boxShadow: "0 -4px 40px -8px rgba(20,15,8,0.25)" }}>

        <div style={{ position: "absolute", top: 10, left: "50%", transform: "translateX(-50%)", width: 40, height: 4, borderRadius: 2, background: "var(--px-line)" }} />

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 22, paddingBottom: 20, flexShrink: 0 }}>
          {!success && (
            <>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em" }}>
                {selected ? "Confirmar salida" : "¿Quién sale?"}
              </h2>
              <button onClick={onClose} style={{ background: "var(--px-paper)", border: "1px solid var(--px-line)", borderRadius: 20, width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--px-mid)", fontSize: 18 }}>×</button>
            </>
          )}
        </div>

        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>

          {/* Success */}
          {success && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, textAlign: "center" }}>
              <div style={{ width: 64, height: 64, borderRadius: 32, background: "var(--px-alert)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg viewBox="0 0 24 24" width={28} height={28} fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
              </div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.02em" }}>Salida registrada</div>
                <div style={{ fontSize: 14, color: "var(--px-mid)", marginTop: 4 }}>{whoToRegister} · {nowTime()}</div>
              </div>
            </div>
          )}

          {/* Selection step */}
          {!success && !selected && (
            <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
              {/* Search */}
              <label style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", background: "white", border: "1px solid var(--px-line)", borderRadius: 10, marginBottom: 14 }}>
                <IconSearch size={16} style={{ color: "var(--px-mid)", flexShrink: 0 }} />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar por nombre o unidad…"
                  style={{ flex: 1, border: "none", outline: "none", fontSize: 15, background: "transparent", fontFamily: "var(--font-inter-tight), Inter, system-ui, sans-serif", color: "var(--px-ink)" }}
                />
              </label>

              {/* Recent entries list */}
              {filtered.length > 0 ? (
                <>
                  <div style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 10, letterSpacing: "0.08em", color: "var(--px-mid)", marginBottom: 8 }}>
                    INGRESOS RECIENTES
                  </div>
                  <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
                    {filtered.map((a, i) => (
                      <button
                        key={a.id ?? i}
                        onClick={() => setSelected(a)}
                        style={{ background: "white", border: "1px solid var(--px-line)", borderRadius: 10, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", font: "inherit", textAlign: "left" }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--px-paper)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "white")}
                      >
                        <div style={{ width: 36, height: 36, borderRadius: 18, background: "var(--px-line)", color: "var(--px-ink2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
                          {initials(a.who)}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 500, fontSize: 14 }}>{a.who}</div>
                          <div style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 11, color: "var(--px-mid)" }}>
                            {a.t}{a.unit ? ` · ${a.unit}` : ""}
                          </div>
                        </div>
                        <span style={{ color: "var(--px-alert)", fontSize: 16 }}>↑</span>
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div style={{ padding: "20px 0", textAlign: "center", color: "var(--px-mid)", fontSize: 14 }}>
                  No hay ingresos recientes.
                </div>
              )}

              {/* Manual name fallback */}
              <div style={{ marginTop: 14 }}>
                <div style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 10, letterSpacing: "0.08em", color: "var(--px-mid)", marginBottom: 8 }}>
                  O INGRESA EL NOMBRE MANUALMENTE
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                    placeholder="Nombre de quien sale…"
                    style={{ flex: 1, padding: "10px 14px", fontSize: 14, fontFamily: "var(--font-inter-tight), Inter, system-ui, sans-serif", background: "white", border: "1px solid var(--px-line)", borderRadius: 10, outline: "none", color: "var(--px-ink)" }}
                  />
                  <button
                    onClick={handleConfirm}
                    disabled={!manualName.trim() || saving}
                    style={{ padding: "10px 16px", background: manualName.trim() ? "var(--px-alert)" : "var(--px-line)", color: "var(--px-bone)", border: "none", borderRadius: 10, font: "inherit", fontSize: 14, fontWeight: 600, cursor: manualName.trim() ? "pointer" : "not-allowed", whiteSpace: "nowrap" }}
                  >
                    {saving ? "…" : "Registrar ↑"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Confirm step */}
          {!success && selected && (
            <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
              <div style={{ background: "var(--px-paper)", border: "1px solid var(--px-line)", borderRadius: 14, padding: "18px 20px", marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 21, background: "var(--px-alert)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 600, flexShrink: 0 }}>
                    {initials(selected.who)}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 17 }}>{selected.who}</div>
                    <div style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 11, color: "var(--px-mid)" }}>ingresó {selected.t}{selected.unit ? ` · ${selected.unit}` : ""}</div>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", paddingTop: 14, borderTop: "1px solid var(--px-line)", gap: 12 }}>
                  <div>
                    <div style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 10, color: "var(--px-mid)", marginBottom: 4 }}>SALIDA</div>
                    <div style={{ fontWeight: 600, fontSize: 15, color: "var(--px-alert)" }}>SALIDA</div>
                  </div>
                  <div>
                    <div style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 10, color: "var(--px-mid)", marginBottom: 4 }}>HORA</div>
                    <div style={{ fontWeight: 600, fontSize: 15, fontFamily: "var(--font-jetbrains-mono)" }}>{nowTime()}</div>
                  </div>
                </div>
              </div>

              <div style={{ flex: 1 }} />
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setSelected(null)} style={{ padding: "14px 18px", background: "white", border: "1px solid var(--px-line)", borderRadius: 12, cursor: "pointer", font: "inherit", fontSize: 14, color: "var(--px-ink2)" }}>
                  ← Atrás
                </button>
                <button onClick={handleConfirm} disabled={saving} style={{ flex: 1, padding: "14px", background: saving ? "var(--px-mid)" : "var(--px-alert)", color: "white", border: "none", borderRadius: 12, font: "inherit", fontSize: 15, fontWeight: 600, cursor: saving ? "default" : "pointer" }}>
                  {saving ? "Guardando…" : "Registrar salida ↑"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

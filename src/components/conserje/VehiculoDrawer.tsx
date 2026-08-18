"use client";

import { useState, useEffect, useRef } from "react";
import { registerEntry } from "@/app/actions";
import { useFocusOnOpen, useResetOnOpen } from "@/lib/drawer";
import type { ActivityItem } from "@/lib/mock-data";

type Dir = "in" | "out";

interface Props {
  open: boolean;
  onClose: () => void;
  onRegistered: (item: ActivityItem) => void;
}

function nowTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function VehiculoDrawer({ open, onClose, onRegistered }: Props) {
  const [plate, setPlate]   = useState("");
  const [dir, setDir]       = useState<Dir | null>(null);
  const [unit, setUnit]     = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useResetOnOpen(open, () => {
    setPlate(""); setDir(null); setUnit(""); setSaving(false); setSuccess(false);
  });
  useFocusOnOpen(open, inputRef);

  useEffect(() => {
    if (success) {
      const id = setTimeout(onClose, 1800);
      return () => clearTimeout(id);
    }
  }, [success, onClose]);

  async function handleConfirm() {
    if (!plate.trim() || !dir) return;
    setSaving(true);
    try {
      const result = await registerEntry({
        type: "vehicle",
        who: plate.trim().toUpperCase(),
        context: dir === "in" ? "Vehículo · Ingreso" : "Vehículo · Salida",
        unit: unit.trim() || undefined,
        plate: plate.trim().toUpperCase(),
      });
      onRegistered({
        id: result.id,
        t: new Date(result.recorded_at).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", hour12: false }),
        dir: "vehicle",
        who: result.who,
        ctx: result.recorded_by ?? "",
        unit: result.unit ?? "",
        plate: result.plate,
        by: result.recorded_by ?? "",
      });
      setSuccess(true);
    } finally {
      setSaving(false);
    }
  }

  const canConfirm = plate.trim().length >= 3 && dir !== null;

  const DRAWER_STYLE: React.CSSProperties = {
    position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50,
    background: "var(--px-bone)", borderRadius: "24px 24px 0 0",
    padding: "0 28px 36px", maxHeight: "70dvh",
    display: "flex", flexDirection: "column",
    transform: open ? "translateY(0)" : "translateY(100%)",
    transition: "transform 0.28s cubic-bezier(0.32, 0.72, 0, 1)",
    boxShadow: "0 -4px 40px -8px rgba(20,15,8,0.25)",
  };

  return (
    <>
      <div style={{ position: "fixed", inset: 0, background: "rgba(20,15,8,0.45)", zIndex: 40, opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none", transition: "opacity 0.2s" }} />
      <div style={DRAWER_STYLE}>
        {/* Handle */}
        <div style={{ position: "absolute", top: 10, left: "50%", transform: "translateX(-50%)", width: 40, height: 4, borderRadius: 2, background: "var(--px-line)" }} />

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 22, paddingBottom: 20, flexShrink: 0 }}>
          {!success && (
            <>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em" }}>Vehículo</h2>
              <button onClick={onClose} style={{ background: "var(--px-paper)", border: "1px solid var(--px-line)", borderRadius: 20, width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--px-mid)", fontSize: 18 }}>×</button>
            </>
          )}
        </div>

        {success ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, textAlign: "center" }}>
            <div style={{ width: 64, height: 64, borderRadius: 32, background: "var(--px-ok)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg viewBox="0 0 24 24" width={28} height={28} fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.02em" }}>Vehículo registrado</div>
              <div style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 14, color: "var(--px-mid)", marginTop: 6 }}>{plate.toUpperCase()} · {nowTime()}</div>
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Plate */}
            <div>
              <div style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 10, letterSpacing: "0.08em", color: "var(--px-mid)", marginBottom: 8 }}>PLACA</div>
              <input
                ref={inputRef}
                type="text"
                value={plate}
                onChange={(e) => setPlate(e.target.value.toUpperCase())}
                placeholder="ABCD·12"
                maxLength={8}
                style={{ width: "100%", padding: "14px 16px", fontSize: 22, fontFamily: "var(--font-jetbrains-mono)", letterSpacing: "0.1em", background: "white", border: "1px solid var(--px-line)", borderRadius: 12, outline: "none", color: "var(--px-ink)", textAlign: "center" }}
              />
            </div>

            {/* Direction */}
            <div>
              <div style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 10, letterSpacing: "0.08em", color: "var(--px-mid)", marginBottom: 8 }}>DIRECCIÓN</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {(["in", "out"] as Dir[]).map((d) => (
                  <button
                    key={d}
                    onClick={() => setDir(d)}
                    style={{
                      padding: "16px", borderRadius: 12, cursor: "pointer", font: "inherit",
                      fontSize: 16, fontWeight: 600, letterSpacing: "-0.01em",
                      border: dir === d ? "2px solid var(--px-ink)" : "1px solid var(--px-line)",
                      background: dir === d ? "var(--px-ink)" : "white",
                      color: dir === d ? "var(--px-bone)" : "var(--px-ink)",
                    }}
                  >
                    {d === "in" ? "↓ Entra" : "↑ Sale"}
                  </button>
                ))}
              </div>
            </div>

            {/* Optional unit */}
            <div>
              <div style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 10, letterSpacing: "0.08em", color: "var(--px-mid)", marginBottom: 8 }}>UNIDAD · OPCIONAL</div>
              <input
                type="text"
                value={unit}
                onChange={(e) => setUnit(e.target.value.toUpperCase())}
                placeholder="ej. 304"
                style={{ width: "100%", padding: "12px 16px", fontSize: 15, fontFamily: "var(--font-jetbrains-mono)", background: "white", border: "1px solid var(--px-line)", borderRadius: 10, outline: "none", color: "var(--px-ink)" }}
              />
            </div>

            <div style={{ flex: 1 }} />

            <button
              onClick={handleConfirm}
              disabled={!canConfirm || saving}
              style={{
                width: "100%", padding: "16px", background: canConfirm && !saving ? "var(--px-ink)" : "var(--px-line)",
                color: "var(--px-bone)", border: "none", borderRadius: 12,
                font: "inherit", fontSize: 16, fontWeight: 600, letterSpacing: "-0.01em",
                cursor: canConfirm && !saving ? "pointer" : "not-allowed",
              }}
            >
              {saving ? "Guardando…" : "Registrar vehículo"}
            </button>
          </div>
        )}
      </div>
    </>
  );
}

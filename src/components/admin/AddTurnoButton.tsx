"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Drawer, { FIELD, LABEL, BTN_PRIMARY } from "./Drawer";
import { addShift } from "@/app/actions";
import { todayInChile } from "@/lib/fecha";
import type { StaffRow } from "@/lib/db";

type ShiftType = "mañana" | "tarde" | "noche";

const SHIFT_PRESETS: Record<ShiftType, { start: string; end: string }> = {
  "mañana": { start: "07:00", end: "15:00" },
  "tarde":  { start: "15:00", end: "23:00" },
  "noche":  { start: "23:00", end: "07:00" },
};

// El día que propone el formulario es el del edificio: con UTC, después de
// las 20:00 ofrecía el turno de mañana.
const today = todayInChile;

function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ marginBottom: 16 }}>{children}</div>;
}

export default function AddTurnoButton({ staffList }: { staffList: StaffRow[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [staffId, setStaffId] = useState(staffList[0]?.id ?? "");
  const [date, setDate] = useState(today());
  const [type, setType] = useState<ShiftType>("mañana");
  const [startTime, setStartTime] = useState("07:00");
  const [endTime, setEndTime] = useState("15:00");
  const [location, setLocation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleTypeChange(t: ShiftType) {
    setType(t);
    setStartTime(SHIFT_PRESETS[t].start);
    setEndTime(SHIFT_PRESETS[t].end);
  }

  function reset() {
    setStaffId(staffList[0]?.id ?? "");
    setDate(today());
    handleTypeChange("mañana");
    setLocation("");
    setError(null);
  }

  function close() { setOpen(false); reset(); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!staffId) { setError("Selecciona un conserje"); return; }
    setLoading(true);
    setError(null);
    const res = await addShift({
      staffId,
      date,
      type,
      startTime,
      endTime,
      location: location || undefined,
    });
    if (res.ok) {
      close();
      router.refresh();
    } else {
      setError(res.error ?? "No se creó el turno. Prueba de nuevo.");
    }
    setLoading(false);
  }

  const noStaff = staffList.length === 0;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          background: "var(--px-ink)", color: "var(--px-bone)", border: "none",
          borderRadius: 8, padding: "9px 14px", fontSize: 13, fontWeight: 500,
          whiteSpace: "nowrap", flexShrink: 0,
          fontFamily: "var(--font-inter-tight), Inter, system-ui, sans-serif",
          cursor: "pointer",
        }}
      >
        + Nuevo turno
      </button>

      <Drawer open={open} onClose={close} title="Nuevo turno">
        {noStaff ? (
          <div style={{ padding: "20px 0", fontFamily: "var(--font-jetbrains-mono)", fontSize: 12, color: "var(--px-mid)", lineHeight: 1.7 }}>
            Primero agrega personal usando el botón &quot;Agregar personal&quot;.
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <Row>
              <label style={{ display: "block" }}><span style={LABEL}>Conserje *</span>
              <select value={staffId} onChange={(e) => setStaffId(e.target.value)}
                style={{ ...FIELD, cursor: "pointer" }}>
                {staffList.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} — {s.role}</option>
                ))}
              </select></label>
            </Row>
            <Row>
              <label style={{ display: "block" }}><span style={LABEL}>Fecha *</span>
              <input type="date" required value={date}
                onChange={(e) => setDate(e.target.value)} style={FIELD} /></label>
            </Row>
            <Row>
              <span id="turno-tipo" style={LABEL}>Tipo de turno *</span>
              <div role="group" aria-labelledby="turno-tipo" style={{ display: "flex", gap: 8 }}>
                {(["mañana", "tarde", "noche"] as ShiftType[]).map((t) => (
                  <button
                    key={t} type="button"
                    onClick={() => handleTypeChange(t)}
                    aria-pressed={type === t}
                    style={{
                      flex: 1, padding: "9px 0",
                      borderRadius: 8, fontSize: 13, fontWeight: 500,
                      fontFamily: "var(--font-inter-tight), Inter, system-ui, sans-serif",
                      cursor: "pointer",
                      border: type === t ? "2px solid var(--px-ink)" : "1px solid var(--px-line)",
                      background: type === t ? "var(--px-ink)" : "white",
                      color: type === t ? "var(--px-bone)" : "var(--px-ink2)",
                      textTransform: "capitalize",
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </Row>
            <Row>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block" }}><span style={LABEL}>Hora inicio *</span>
                  <input type="time" required value={startTime}
                    onChange={(e) => setStartTime(e.target.value)} style={FIELD} /></label>
                </div>
                <div>
                  <label style={{ display: "block" }}><span style={LABEL}>Hora fin *</span>
                  <input type="time" required value={endTime}
                    onChange={(e) => setEndTime(e.target.value)} style={FIELD} /></label>
                </div>
              </div>
            </Row>
            <Row>
              <label style={{ display: "block" }}><span style={LABEL}>Ubicación / Torre</span>
              <input value={location} onChange={(e) => setLocation(e.target.value)}
                placeholder="Ej: Torre A, Portería principal" style={FIELD} /></label>
            </Row>

            {error && (
              <div style={{ marginBottom: 16, padding: "9px 12px", borderRadius: 8, background: "oklch(0.96 0.05 28)", color: "var(--px-alert)", fontSize: 13, border: "1px solid oklch(0.88 0.12 28)" }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              style={{ ...BTN_PRIMARY, opacity: loading ? 0.6 : 1, cursor: loading ? "not-allowed" : "pointer" }}>
              {loading ? "Guardando…" : "Crear turno"}
            </button>
          </form>
        )}
      </Drawer>
    </>
  );
}

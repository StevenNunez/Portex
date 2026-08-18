"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Drawer, { FIELD, LABEL, BTN_PRIMARY } from "./Drawer";
import { closeAttendanceAsAdmin } from "@/app/asistencia-actions";

/**
 * Cerrar a mano una jornada que quedó abierta.
 *
 * Pasa siempre: alguien se va sin marcar. Si nadie la cierra, esa persona no
 * puede volver a marcar entrada (nadie puede tener dos jornadas abiertas) y
 * las horas del mes quedan infladas.
 */
export default function CloseAttendanceButton({
  attendanceId,
  staffName,
  checkedInAt,
}: {
  attendanceId: string;
  staffName: string;
  checkedInAt: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [time, setTime] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const entrada = new Date(checkedInAt).toLocaleString("es-CL", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false,
  });

  function abrir() {
    setError(null);
    setNote("");
    // Se propone la hora actual: lo más común es cerrar ahora mismo.
    const ahora = new Date().toLocaleTimeString("es-CL", {
      hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Santiago",
    });
    setTime(ahora);
    setOpen(true);
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const res = await closeAttendanceAsAdmin({ attendanceId, time, note: note || undefined });
    setSaving(false);

    if (!res.ok) {
      setError(res.error ?? "No se pudo cerrar la jornada");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        onClick={abrir}
        style={{
          flexShrink: 0, background: "white", border: "1px solid var(--px-line)",
          borderRadius: 8, padding: "7px 11px", fontSize: 12,
          fontFamily: "var(--font-inter-tight), Inter, system-ui, sans-serif",
          color: "var(--px-ink2)", cursor: "pointer",
        }}
      >
        Cerrar jornada
      </button>

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title="Cerrar jornada"
        subtitle={`${staffName.toUpperCase()} · ENTRÓ ${entrada.toUpperCase()}`}
      >
        <form onSubmit={guardar}>
          <div style={{ marginBottom: 16 }}>
            <label style={LABEL}>Hora de salida *</label>
            <input
              required
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              style={{ ...FIELD, fontFamily: "var(--font-jetbrains-mono)" }}
            />
            <div style={{ fontSize: 11.5, color: "var(--px-mid)", marginTop: 6, lineHeight: 1.5 }}>
              Si la hora es anterior a la de entrada, se entiende como la madrugada
              siguiente: es el turno de noche.
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={LABEL}>Nota</label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Se fue sin marcar"
              style={FIELD}
            />
          </div>

          {error && (
            <div style={{ marginBottom: 16, padding: "9px 12px", borderRadius: 8, background: "oklch(0.96 0.05 28)", color: "var(--px-alert)", fontSize: 13, border: "1px solid oklch(0.88 0.12 28)" }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={saving} style={{ ...BTN_PRIMARY, opacity: saving ? 0.6 : 1 }}>
            {saving ? "Guardando…" : "Cerrar jornada"}
          </button>
        </form>
      </Drawer>
    </>
  );
}

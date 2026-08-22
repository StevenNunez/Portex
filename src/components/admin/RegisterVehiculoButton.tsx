"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Drawer, { FIELD, LABEL, BTN_PRIMARY } from "./Drawer";
import { registerEntry } from "@/app/actions";

function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ marginBottom: 16 }}>{children}</div>;
}

export default function RegisterVehiculoButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [plate, setPlate] = useState("");
  const [who, setWho] = useState("");
  const [unit, setUnit] = useState("");
  const [context, setContext] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setPlate(""); setWho(""); setUnit(""); setContext(""); setError(null);
  }

  function close() { setOpen(false); reset(); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await registerEntry({
        type: "vehicle",
        who,
        plate: plate.toUpperCase(),
        unit: unit || undefined,
        context: context || undefined,
      });
      close();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al registrar");
    }
    setLoading(false);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          background: "var(--px-ink)", color: "var(--px-bone)", border: "none",
          borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 500,
          whiteSpace: "nowrap", flexShrink: 0,
          fontFamily: "var(--font-inter-tight), Inter, system-ui, sans-serif",
          cursor: "pointer",
        }}
      >
        + Registrar vehículo
      </button>

      <Drawer open={open} onClose={close} title="Registrar vehículo" subtitle="TIPO · ACCESO VEHICULAR">
        <form onSubmit={handleSubmit}>
          <Row>
            <label style={LABEL}>Patente *</label>
            <input required value={plate}
              onChange={(e) => setPlate(e.target.value.toUpperCase())}
              placeholder="Ej: ABCD12" maxLength={8}
              style={{ ...FIELD, fontFamily: "var(--font-jetbrains-mono), monospace", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }} />
          </Row>
          <Row>
            <label style={LABEL}>Conductor / Propietario *</label>
            <input required value={who} onChange={(e) => setWho(e.target.value)}
              placeholder="Nombre de la persona" style={FIELD} />
          </Row>
          <Row>
            <label style={LABEL}>Unidad</label>
            <input value={unit} onChange={(e) => setUnit(e.target.value)}
              placeholder="Ej: 302, A-801" style={FIELD} />
          </Row>
          <Row>
            <label style={LABEL}>Observación</label>
            <input value={context} onChange={(e) => setContext(e.target.value)}
              placeholder="Ej: Visita, Proveedor, Mudanza" style={FIELD} />
          </Row>

          {error && (
            <div style={{ marginBottom: 16, padding: "9px 12px", borderRadius: 8, background: "oklch(0.96 0.05 28)", color: "var(--px-alert)", fontSize: 13, border: "1px solid oklch(0.88 0.12 28)" }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading}
            style={{ ...BTN_PRIMARY, opacity: loading ? 0.6 : 1, cursor: loading ? "not-allowed" : "pointer" }}>
            {loading ? "Registrando…" : "Registrar vehículo"}
          </button>
        </form>
      </Drawer>
    </>
  );
}

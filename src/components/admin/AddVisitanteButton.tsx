"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Drawer, { FIELD, LABEL, BTN_PRIMARY } from "./Drawer";
import { addFrequentVisitor } from "@/app/actions";
import { formatRutInput } from "@/lib/rut";

function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ marginBottom: 16 }}>{children}</div>;
}

export default function AddVisitanteButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [rut, setRut] = useState("");
  const [defaultUnit, setDefaultUnit] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setName(""); setRut(""); setDefaultUnit(""); setReason(""); setError(null);
  }

  function close() { setOpen(false); reset(); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await addFrequentVisitor({
      name,
      rut: rut || undefined,
      defaultUnit: defaultUnit || undefined,
      reason: reason || undefined,
    });
    if (res.ok) {
      close();
      router.refresh();
    } else {
      setError(res.error ?? "Error al agregar visitante");
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
        + Agregar visitante
      </button>

      <Drawer open={open} onClose={close} title="Agregar visitante frecuente">
        <form onSubmit={handleSubmit}>
          <Row>
            <label style={LABEL}>Nombre completo *</label>
            <input required value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Nombre y apellido" style={FIELD} />
          </Row>
          <Row>
            <label style={LABEL}>RUT *</label>
            <input required value={rut} onChange={(e) => setRut(formatRutInput(e.target.value))}
              placeholder="Ej: 12.345.678-9" maxLength={12}
              style={{ ...FIELD, fontFamily: "var(--font-jetbrains-mono), monospace", letterSpacing: "0.03em" }} />
            <div style={{ fontSize: 11, color: "var(--px-mid)", marginTop: 4 }}>
              Es la llave con la que la portería lo reconoce al llegar.
            </div>
          </Row>
          <Row>
            <label style={LABEL}>Unidad habitual</label>
            <input value={defaultUnit} onChange={(e) => setDefaultUnit(e.target.value)}
              placeholder="Ej: 402, B-201" style={FIELD} />
          </Row>
          <Row>
            <label style={LABEL}>Motivo de visita</label>
            <input value={reason} onChange={(e) => setReason(e.target.value)}
              placeholder="Ej: Familiar, Empleada doméstica, Proveedor" style={FIELD} />
          </Row>

          {error && (
            <div style={{ marginBottom: 16, padding: "9px 12px", borderRadius: 8, background: "oklch(0.96 0.05 28)", color: "var(--px-alert)", fontSize: 13, border: "1px solid oklch(0.88 0.12 28)" }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading}
            style={{ ...BTN_PRIMARY, opacity: loading ? 0.6 : 1, cursor: loading ? "not-allowed" : "pointer" }}>
            {loading ? "Guardando…" : "Agregar visitante"}
          </button>
        </form>
      </Drawer>
    </>
  );
}

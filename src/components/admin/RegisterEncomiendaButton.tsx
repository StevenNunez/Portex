"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Drawer, { FIELD, LABEL, BTN_PRIMARY } from "./Drawer";
import { registerEntry } from "@/app/actions";
import { mensajeParaPersona } from "@/lib/errores";

function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ marginBottom: 16 }}>{children}</div>;
}

export default function RegisterEncomiendaButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [unit, setUnit] = useState("");
  // `who` es quién trajo el paquete —la empresa—, no a quién va dirigido: el
  // destinatario se deduce de la unidad, como en portería.
  const [who, setWho] = useState("");
  const [context, setContext] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setUnit(""); setWho(""); setContext(""); setError(null);
  }

  function close() { setOpen(false); reset(); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await registerEntry({ type: "parcel", who, unit, context: context || undefined });
      close();
      router.refresh();
    } catch (err) {
      setError(mensajeParaPersona(err, "registrar encomienda (admin)"));
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
        + Registrar encomienda
      </button>

      <Drawer open={open} onClose={close} title="Registrar encomienda" subtitle="TIPO · ENCOMIENDA / PAQUETE">
        <form onSubmit={handleSubmit}>
          <Row>
            <label style={{ display: "block" }}><span style={LABEL}>Unidad destino *</span>
            <input required value={unit} onChange={(e) => setUnit(e.target.value)}
              placeholder="Ej: 504, B-302" style={FIELD} /></label>
          </Row>
          <Row>
            <label style={{ display: "block" }}><span style={LABEL}>¿Quién la trajo? *</span>
            <input required value={who} onChange={(e) => setWho(e.target.value)}
              placeholder="Ej: Chilexpress, Amazon, Blue Express" style={FIELD} /></label>
          </Row>
          <Row>
            <label style={{ display: "block" }}><span style={LABEL}>
              Descripción{" "}
              <span style={{ fontWeight: 400, color: "var(--px-mid)", fontSize: 11 }}>
                — opcional, la ve el residente
              </span>
            </span>
            <input value={context} onChange={(e) => setContext(e.target.value)}
              placeholder="Ej: caja grande, sobre acolchado" style={FIELD} /></label>
          </Row>
          <div style={{ fontSize: 11.5, color: "var(--px-mid)", margin: "-6px 0 16px", lineHeight: 1.5 }}>
            Al residente le llega el aviso con su código de retiro.
          </div>

          {error && (
            <div style={{ marginBottom: 16, padding: "9px 12px", borderRadius: 8, background: "oklch(0.96 0.05 28)", color: "var(--px-alert)", fontSize: 13, border: "1px solid oklch(0.88 0.12 28)" }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading}
            style={{ ...BTN_PRIMARY, opacity: loading ? 0.6 : 1, cursor: loading ? "not-allowed" : "pointer" }}>
            {loading ? "Registrando…" : "Registrar encomienda"}
          </button>
        </form>
      </Drawer>
    </>
  );
}

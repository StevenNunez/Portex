"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Drawer, { FIELD, LABEL, BTN_PRIMARY } from "./Drawer";
import { addResident } from "@/app/actions";

type Status = "activo" | "pendiente" | "inactivo";

function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ marginBottom: 16 }}>{children}</div>;
}

export default function AddResidenteButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [unitCode, setUnitCode] = useState("");
  const [name, setName] = useState("");
  const [household, setHousehold] = useState("");
  const [rut, setRut] = useState("");
  const [contact, setContact] = useState("");
  const [status, setStatus] = useState<Status>("activo");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setUnitCode(""); setName(""); setHousehold(""); setRut(""); setContact(""); setStatus("activo"); setError(null);
  }

  function close() { setOpen(false); reset(); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await addResident({
      unitCode,
      name,
      household: household || undefined,
      rut: rut || undefined,
      contact: contact || undefined,
      status,
    });
    if (res.ok) {
      close();
      router.refresh();
    } else {
      setError(res.error ?? "Error al agregar residente");
    }
    setLoading(false);
  }

  const STATUS_OPTS: { value: Status; label: string }[] = [
    { value: "activo",    label: "Activo" },
    { value: "pendiente", label: "Pendiente" },
    { value: "inactivo",  label: "Inactivo" },
  ];

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          background: "var(--px-ink)", color: "var(--px-bone)", border: "none",
          borderRadius: 8, padding: "9px 14px", fontSize: 13, fontWeight: 500,
          fontFamily: "var(--font-inter-tight), Inter, system-ui, sans-serif",
          cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
          whiteSpace: "nowrap", flexShrink: 0,
        }}
      >
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M6.5 1v11M1 6.5h11" />
        </svg>
        Nuevo residente
      </button>

      <Drawer open={open} onClose={close} title="Nuevo residente">
        <form onSubmit={handleSubmit}>
          <Row>
            <label style={LABEL}>Código de unidad *</label>
            <input required value={unitCode} onChange={(e) => setUnitCode(e.target.value.toUpperCase())}
              placeholder="Ej: 101, 1204, A-501"
              style={{ ...FIELD, fontFamily: "var(--font-jetbrains-mono), monospace", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }} />
          </Row>
          <Row>
            <label style={LABEL}>Nombre titular *</label>
            <input required value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Nombre y apellido" style={FIELD} />
          </Row>
          <Row>
            <label style={LABEL}>Grupo familiar</label>
            <input value={household} onChange={(e) => setHousehold(e.target.value)}
              placeholder="Ej: Juan López + 2 hijos" style={FIELD} />
          </Row>
          <Row>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={LABEL}>RUT</label>
                <input value={rut} onChange={(e) => setRut(e.target.value)}
                  placeholder="12.345.678-9" style={FIELD} />
              </div>
              <div>
                <label style={LABEL}>Contacto</label>
                <input value={contact} onChange={(e) => setContact(e.target.value)}
                  placeholder="+56 9 1234 5678" style={FIELD} />
              </div>
            </div>
          </Row>
          <Row>
            <label style={LABEL}>Estado</label>
            <div style={{ display: "flex", gap: 8 }}>
              {STATUS_OPTS.map((s) => (
                <button
                  key={s.value} type="button"
                  onClick={() => setStatus(s.value)}
                  style={{
                    flex: 1, padding: "8px 0",
                    borderRadius: 8, fontSize: 12.5, fontWeight: 500,
                    fontFamily: "var(--font-inter-tight), Inter, system-ui, sans-serif",
                    cursor: "pointer",
                    border: status === s.value ? "2px solid var(--px-ink)" : "1px solid var(--px-line)",
                    background: status === s.value ? "var(--px-ink)" : "white",
                    color: status === s.value ? "var(--px-bone)" : "var(--px-ink2)",
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </Row>

          {error && (
            <div style={{ marginBottom: 16, padding: "9px 12px", borderRadius: 8, background: "oklch(0.96 0.05 28)", color: "var(--px-alert)", fontSize: 13, border: "1px solid oklch(0.88 0.12 28)" }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading}
            style={{ ...BTN_PRIMARY, opacity: loading ? 0.6 : 1, cursor: loading ? "not-allowed" : "pointer" }}>
            {loading ? "Guardando…" : "Agregar residente"}
          </button>
        </form>
      </Drawer>
    </>
  );
}

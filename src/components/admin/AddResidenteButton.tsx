"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Drawer, { FIELD, LABEL, BTN_PRIMARY } from "./Drawer";
import { addResident } from "@/app/actions";
import { formatoDelPadron } from "@/app/padron-actions";
import { construirUnidad, type FormatoUnidad } from "@/lib/residentes";

function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ marginBottom: 16 }}>{children}</div>;
}

export default function AddResidenteButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  // Torre y número por separado: el código se arma solo. Antes había que
  // escribirlo a mano y con 300 departamentos eso termina en un padrón con
  // tres formatos distintos y unidades duplicadas.
  const [torre, setTorre] = useState("");
  const [depto, setDepto] = useState("");
  const [formato, setFormato] = useState<FormatoUnidad>({ separador: "-", digitos: 0, torres: [] });
  const [existentes, setExistentes] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [rut, setRut] = useState("");
  const [contact, setContact] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // El formato lo dicta el padrón que ya existe, no nosotros: hay edificios
  // que usan "A · 0307" y otros "A-101". Se lee al abrir el cajón.
  useEffect(() => {
    if (!open) return;
    let vivo = true;
    formatoDelPadron()
      .then((d) => {
        if (!vivo) return;
        setFormato(d.formato);
        setExistentes(d.existentes);
      })
      .catch(() => {});
    return () => { vivo = false; };
  }, [open]);

  const unitCode = construirUnidad(torre, depto, formato);
  const yaExiste = unitCode !== "" && existentes.includes(unitCode);

  function reset() {
    setTorre(""); setDepto(""); setName(""); setEmail(""); setRut(""); setContact(""); setError(null);
  }

  function close() { setOpen(false); reset(); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await addResident({
      unitCode,
      name,
      email: email || undefined,
      rut: rut || undefined,
      contact: contact || undefined,
    });
    if (res.ok) {
      close();
      router.refresh();
    } else {
      setError(res.error ?? "No se agregó el residente. Prueba de nuevo.");
    }
    setLoading(false);
  }

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
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ display: "block" }}><span style={LABEL}>
                  Torre{" "}
                  <span style={{ color: "var(--px-mid)", fontWeight: 400, fontSize: 11 }}>
                    — número o nombre
                  </span>
                </span>
                <input
                  value={torre}
                  onChange={(e) => setTorre(e.target.value)}
                  placeholder={formato.torres[0] ?? "A, 1, Chañar 987"}
                  list={formato.torres.length > 0 ? "torres-edificio" : undefined}
                  style={{ ...FIELD, fontFamily: "var(--font-jetbrains-mono), monospace", fontWeight: 600 }}
                /></label>
                {formato.torres.length > 0 && (
                  <datalist id="torres-edificio">
                    {formato.torres.map((t) => <option key={t} value={t} />)}
                  </datalist>
                )}
              </div>
              <div>
                <label style={{ display: "block" }}><span style={LABEL}>N° depto *</span>
                <input
                  required
                  value={depto}
                  onChange={(e) => setDepto(e.target.value)}
                  placeholder="1204"
                  style={{ ...FIELD, fontFamily: "var(--font-jetbrains-mono), monospace", fontWeight: 600, textTransform: "uppercase" }}
                /></label>
              </div>
            </div>

            {/* El código que va a quedar, a la vista antes de guardar. */}
            <div
              style={{
                marginTop: 10, padding: "9px 12px", borderRadius: 8,
                background: yaExiste ? "oklch(0.96 0.05 28)" : "var(--px-paper)",
                border: `1px solid ${yaExiste ? "oklch(0.88 0.12 28)" : "var(--px-line2)"}`,
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
              }}
            >
              <span style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 9.5, letterSpacing: "0.08em", color: "var(--px-mid)" }}>
                QUEDA COMO
              </span>
              <span style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 15, fontWeight: 700 }}>
                {unitCode || "—"}
              </span>
            </div>
            {yaExiste && (
              <div style={{ marginTop: 6, fontSize: 12.5, color: "var(--px-alert)", lineHeight: 1.5 }}>
                Ese departamento ya está en el padrón. Búscalo en la lista y edítalo,
                o revisa el número.
              </div>
            )}
          </Row>
          <Row>
            <label style={{ display: "block" }}><span style={LABEL}>Nombre titular *</span>
            <input required value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Nombre y apellido" style={FIELD} /></label>
          </Row>
          <Row>
            <label style={{ display: "block" }}><span style={LABEL}>
              Correo{" "}
              <span style={{ color: "var(--px-mid)", fontWeight: 400, fontSize: 11 }}>
                — con esto entra a la app
              </span>
            </span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="correo@ejemplo.com" style={FIELD} /></label>
            <div style={{ fontSize: 11.5, color: "var(--px-mid)", marginTop: 4, lineHeight: 1.5 }}>
              Sin correo queda en el padrón, pero no puede autorizar visitas ni recibir avisos.
              Se puede agregar después.
            </div>
          </Row>
          <Row>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ display: "block" }}><span style={LABEL}>RUT</span>
                <input value={rut} onChange={(e) => setRut(e.target.value)}
                  placeholder="12.345.678-9" style={FIELD} /></label>
              </div>
              <div>
                <label style={{ display: "block" }}><span style={LABEL}>Contacto</span>
                <input value={contact} onChange={(e) => setContact(e.target.value)}
                  placeholder="+56 9 1234 5678" style={FIELD} /></label>
              </div>
            </div>
          </Row>
          {error && (
            <div style={{ marginBottom: 16, padding: "9px 12px", borderRadius: 8, background: "oklch(0.96 0.05 28)", color: "var(--px-alert)", fontSize: 13, border: "1px solid oklch(0.88 0.12 28)" }}>
              {error}
            </div>
          )}

          {(() => {
            const bloqueado = loading || !unitCode || yaExiste;
            return (
              <button type="submit" disabled={bloqueado}
                style={{ ...BTN_PRIMARY, opacity: bloqueado ? 0.5 : 1, cursor: bloqueado ? "not-allowed" : "pointer" }}>
                {loading ? "Guardando…" : yaExiste ? "Ese departamento ya existe" : "Agregar residente"}
              </button>
            );
          })()}
        </form>
      </Drawer>
    </>
  );
}

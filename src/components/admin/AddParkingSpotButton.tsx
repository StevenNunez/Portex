"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Drawer, { FIELD, LABEL, BTN_PRIMARY } from "./Drawer";
import { addParkingSpot } from "@/app/actions";
import type { ParkingKind } from "@/lib/database.types";

function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ marginBottom: 16 }}>{children}</div>;
}

export default function AddParkingSpotButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [kind, setKind] = useState<ParkingKind>("residente");
  const [unitCode, setUnitCode] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Cargar un estacionamiento por vez sería tedioso: son decenas. El drawer se
  // queda abierto y muestra los que ya se agregaron en esta tanda.
  const [agregados, setAgregados] = useState<string[]>([]);

  function close() {
    setOpen(false);
    setCode(""); setUnitCode(""); setNotes(""); setError(null); setAgregados([]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await addParkingSpot({
      code,
      kind,
      unitCode: kind === "residente" ? unitCode : undefined,
      notes: notes || undefined,
    });

    if (res.ok) {
      setAgregados((prev) => [code.trim().toUpperCase(), ...prev]);
      setCode("");
      setUnitCode("");
      setNotes("");
      router.refresh();
    } else {
      setError(res.error ?? "No se pudo agregar el estacionamiento");
    }
    setLoading(false);
  }

  const KINDS: { value: ParkingKind; label: string; hint: string }[] = [
    { value: "residente", label: "De un depto", hint: "Pertenece a una unidad" },
    { value: "visita", label: "De visita", hint: "Lo usa cualquier visita" },
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
        }}
      >
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M6.5 1v11M1 6.5h11" />
        </svg>
        Agregar estacionamiento
      </button>

      <Drawer open={open} onClose={close} title="Nuevo estacionamiento">
        <form onSubmit={handleSubmit}>
          <Row>
            <label style={LABEL}>¿De quién es? *</label>
            <div style={{ display: "flex", gap: 8 }}>
              {KINDS.map((k) => (
                <button
                  key={k.value}
                  type="button"
                  onClick={() => setKind(k.value)}
                  style={{
                    flex: 1, padding: "10px 8px", borderRadius: 8,
                    fontFamily: "var(--font-inter-tight), Inter, system-ui, sans-serif",
                    cursor: "pointer", textAlign: "left",
                    border: kind === k.value ? "2px solid var(--px-ink)" : "1px solid var(--px-line)",
                    background: kind === k.value ? "var(--px-ink)" : "white",
                    color: kind === k.value ? "var(--px-bone)" : "var(--px-ink2)",
                  }}
                >
                  <span style={{ display: "block", fontSize: 13, fontWeight: 600 }}>{k.label}</span>
                  <span style={{ display: "block", fontSize: 11, opacity: 0.7, marginTop: 2 }}>{k.hint}</span>
                </button>
              ))}
            </div>
          </Row>

          <Row>
            <label style={LABEL}>Número o código *</label>
            <input
              required
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Ej: E-12, 45, V-3"
              style={{ ...FIELD, fontFamily: "var(--font-jetbrains-mono), monospace", fontWeight: 600, letterSpacing: "0.04em" }}
            />
          </Row>

          {kind === "residente" && (
            <Row>
              <label style={LABEL}>Departamento al que pertenece *</label>
              <input
                required
                value={unitCode}
                onChange={(e) => setUnitCode(e.target.value.toUpperCase())}
                placeholder="Ej: 1204, A-501"
                style={{ ...FIELD, fontFamily: "var(--font-jetbrains-mono), monospace", fontWeight: 600, letterSpacing: "0.04em" }}
              />
              <div style={{ fontSize: 11.5, color: "var(--px-mid)", marginTop: 6, lineHeight: 1.5 }}>
                Tiene que coincidir con el código de unidad del padrón: es así como
                la portería sabe cuál ofrecerle a la visita del 1204.
              </div>
            </Row>
          )}

          <Row>
            <label style={LABEL}>Nota</label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: subterráneo -2, junto al ascensor"
              style={FIELD}
            />
          </Row>

          {error && (
            <div style={{ marginBottom: 16, padding: "9px 12px", borderRadius: 8, background: "oklch(0.96 0.05 28)", color: "var(--px-alert)", fontSize: 13, border: "1px solid oklch(0.88 0.12 28)" }}>
              {error}
            </div>
          )}

          {agregados.length > 0 && (
            <div style={{ marginBottom: 16, padding: "10px 12px", borderRadius: 8, background: "oklch(0.95 0.05 150)", border: "1px solid var(--px-ok)" }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 4 }}>
                {agregados.length} agregado{agregados.length === 1 ? "" : "s"}
              </div>
              <div style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 11, color: "var(--px-ink2)", letterSpacing: "0.04em" }}>
                {agregados.slice(0, 12).join(" · ")}
                {agregados.length > 12 ? " …" : ""}
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{ ...BTN_PRIMARY, opacity: loading ? 0.6 : 1, cursor: loading ? "not-allowed" : "pointer" }}
          >
            {loading ? "Guardando…" : "Agregar y seguir"}
          </button>
        </form>
      </Drawer>
    </>
  );
}

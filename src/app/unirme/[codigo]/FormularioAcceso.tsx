"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import { pedirAcceso } from "@/app/autoregistro-actions";

const CAMPO: CSSProperties = {
  width: "100%",
  padding: "11px 14px",
  fontSize: 15,
  fontFamily: "var(--font-inter-tight), Inter, system-ui, sans-serif",
  border: "1px solid var(--px-line)",
  borderRadius: 9,
  outline: "none",
  background: "white",
  color: "var(--px-ink)",
};

const ETIQUETA: CSSProperties = {
  display: "block",
  fontSize: 13,
  fontWeight: 500,
  marginBottom: 6,
  color: "var(--px-ink2)",
};

export default function FormularioAcceso({
  codigo,
  unidades,
}: {
  codigo: string;
  /** Los departamentos que ya están en el padrón: van de sugerencia. */
  unidades: string[];
}) {
  const [unitCode, setUnitCode] = useState("");
  const [name, setName]         = useState("");
  const [email, setEmail]       = useState("");
  const [phone, setPhone]       = useState("");

  const [cargando, setCargando] = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [listo, setListo]       = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (cargando) return;
    setCargando(true);
    setError(null);

    const res = await pedirAcceso({ codigo, unitCode, name, email, phone });

    if (!res.ok) {
      setError(res.error ?? "No se pudo enviar tu solicitud");
      setCargando(false);
      return;
    }
    setListo(true);
    setCargando(false);
  }

  if (listo) {
    return (
      <div style={{ textAlign: "center", padding: "8px 0" }}>
        <div
          style={{
            width: 52, height: 52, borderRadius: "50%", margin: "0 auto 18px",
            background: "oklch(0.95 0.05 145)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24,
          }}
        >
          ✓
        </div>
        <h2 style={{ margin: "0 0 10px", fontSize: 19, fontWeight: 700, letterSpacing: "-0.03em" }}>
          Listo, quedó pedido
        </h2>
        <p style={{ margin: 0, fontSize: 14, color: "var(--px-mid)", lineHeight: 1.65 }}>
          La portería va a confirmar que vives en el {unitCode.toUpperCase()}. Cuando lo
          haga te llega un correo a <strong style={{ color: "var(--px-ink)" }}>{email}</strong>{" "}
          para crear tu contraseña.
        </p>
        <p style={{ margin: "14px 0 0", fontSize: 12.5, color: "var(--px-mid2)", lineHeight: 1.6 }}>
          Si no llega, pregúntale al conserje — es él quien aprueba.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={enviar}>
      <div style={{ marginBottom: 14 }}>
        <label style={ETIQUETA} htmlFor="unidad">Tu departamento</label>
        <input
          id="unidad"
          required
          value={unitCode}
          onChange={(e) => setUnitCode(e.target.value)}
          placeholder="Ej: A-1204"
          list={unidades.length > 0 ? "unidades-edificio" : undefined}
          autoComplete="off"
          style={{ ...CAMPO, fontFamily: "var(--font-jetbrains-mono), monospace", textTransform: "uppercase" }}
        />
        {/* Sugerencias, no una lista cerrada: hay edificios cuyo padrón todavía
            está vacío, y ahí el vecino tiene que poder escribir el suyo igual. */}
        {unidades.length > 0 && (
          <datalist id="unidades-edificio">
            {unidades.map((u) => <option key={u} value={u} />)}
          </datalist>
        )}
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={ETIQUETA} htmlFor="nombre">Tu nombre completo</label>
        <input
          id="nombre"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej: Ana Vergara"
          autoComplete="name"
          style={CAMPO}
        />
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={ETIQUETA} htmlFor="correo">Tu correo</label>
        <input
          id="correo"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="correo@ejemplo.com"
          autoComplete="email"
          style={CAMPO}
        />
      </div>

      <div style={{ marginBottom: 22 }}>
        <label style={ETIQUETA} htmlFor="fono">
          Tu teléfono <span style={{ color: "var(--px-mid)", fontWeight: 400 }}>— opcional</span>
        </label>
        <input
          id="fono"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+56 9 1234 5678"
          autoComplete="tel"
          style={CAMPO}
        />
      </div>

      {error && (
        <div
          style={{
            background: "oklch(0.96 0.05 28)", border: "1px solid oklch(0.88 0.12 28)",
            borderRadius: 8, padding: "10px 14px", marginBottom: 16,
            fontSize: 13, color: "oklch(0.40 0.18 28)", lineHeight: 1.55,
          }}
        >
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={cargando}
        style={{
          width: "100%", padding: "13px",
          background: "var(--px-ink)", color: "var(--px-bone)",
          border: "none", borderRadius: 10,
          fontSize: 15, fontWeight: 600,
          fontFamily: "var(--font-inter-tight), Inter, system-ui, sans-serif",
          letterSpacing: "-0.02em",
          cursor: cargando ? "not-allowed" : "pointer",
          opacity: cargando ? 0.6 : 1,
        }}
      >
        {cargando ? "Enviando…" : "Pedir acceso →"}
      </button>
    </form>
  );
}

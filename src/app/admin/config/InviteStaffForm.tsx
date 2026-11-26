"use client";

import { useState } from "react";
import { inviteConserje } from "@/app/actions";

const INPUT: React.CSSProperties = {
  flex: 1,
  minWidth: 180,
  padding: "9px 14px",
  fontSize: 13,
  fontFamily: "var(--font-inter-tight), Inter, system-ui, sans-serif",
  border: "1px solid var(--px-line)",
  borderRadius: 8,
  outline: "none",
  background: "white",
  color: "var(--px-ink)",
};

export default function InviteStaffForm({ organizationId }: { organizationId: string }) {
  const [name, setName]   = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState<{ ok: boolean; msg: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    const res = await inviteConserje({ email, name: name.trim() || undefined, organizationId });

    setResult(
      res.ok
        ? { ok: true,  msg: `Invitación enviada a ${email}` }
        : { ok: false, msg: res.error ?? "No pudimos enviar la invitación. Prueba de nuevo." }
    );

    if (res.ok) {
      setName("");
      setEmail("");
    }
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ display: "flex", gap: 8, alignItems: "flex-start", flexWrap: "wrap" }}>
        <input aria-label="Nombre de la persona (opcional)"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nombre (opcional)"
          style={{ ...INPUT, minWidth: 160 }}
        />
        <input aria-label="Correo de la persona"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="correo@ejemplo.com"
          style={INPUT}
        />
        <button
          type="submit"
          disabled={loading}
          style={{
            padding: "9px 18px",
            fontSize: 13,
            fontWeight: 500,
            fontFamily: "var(--font-inter-tight), Inter, system-ui, sans-serif",
            background: loading ? "var(--px-line)" : "var(--px-ink)",
            color: "var(--px-bone)",
            border: "none",
            borderRadius: 8,
            cursor: loading ? "not-allowed" : "pointer",
            flexShrink: 0,
          }}
        >
          {loading ? "Enviando…" : "Enviar invitación"}
        </button>
      </div>

      {result && (
        <div style={{
          marginTop: 10,
          fontSize: 13,
          padding: "9px 14px",
          borderRadius: 8,
          background: result.ok ? "oklch(0.95 0.05 145)" : "oklch(0.96 0.05 28)",
          color:      result.ok ? "var(--px-ok)"          : "var(--px-alert)",
          border: `1px solid ${result.ok ? "oklch(0.88 0.12 145)" : "oklch(0.88 0.12 28)"}`,
        }}>
          {result.msg}
        </div>
      )}
    </form>
  );
}

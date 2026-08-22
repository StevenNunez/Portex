"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import Link from "next/link";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import MarcaPortex from "@/components/MarcaPortex";

const INPUT_STYLE: CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  fontSize: 14,
  fontFamily: "var(--font-inter-tight), Inter, system-ui, sans-serif",
  border: "1px solid var(--px-line)",
  borderRadius: 8,
  outline: "none",
  background: "white",
  color: "var(--px-ink)",
  letterSpacing: "-0.005em",
};

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createSupabaseBrowser();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/update-password`,
    });

    if (resetError) {
      setError(resetError.message);
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
  }

  const wrapperStyle: CSSProperties = {
    minHeight: "100dvh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    background: "var(--px-bone)",
    padding: "40px 20px",
  };

  if (sent) {
    return (
      <div style={wrapperStyle}>
        <MarcaPortex href="/" />
        <div style={{ width: "100%", maxWidth: 380, background: "white", border: "1px solid var(--px-line)", borderRadius: 16, padding: "40px 32px", textAlign: "center" }}>
          <div style={{ fontSize: 36, marginBottom: 20 }}>✉️</div>
          <h2 style={{ margin: "0 0 12px", fontSize: 20, fontWeight: 700, letterSpacing: "-0.03em" }}>
            Revisa tu email
          </h2>
          <p style={{ fontSize: 14, color: "var(--px-mid)", lineHeight: 1.6, margin: 0 }}>
            Enviamos un enlace para restablecer tu contraseña a{" "}
            <strong style={{ color: "var(--px-ink)" }}>{email}</strong>.
          </p>
        </div>
        <p style={{ marginTop: 24, fontSize: 14, color: "var(--px-mid)" }}>
          <Link href="/login" style={{ color: "var(--px-ink)", fontWeight: 500, textDecoration: "none" }}>
            ← Volver al inicio de sesión
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div style={wrapperStyle}>
      <MarcaPortex href="/" />

      <div style={{ width: "100%", maxWidth: 380, background: "white", border: "1px solid var(--px-line)", borderRadius: 16, padding: "36px 32px" }}>
        <h1 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 700, letterSpacing: "-0.03em", color: "var(--px-ink)" }}>
          Recuperar contraseña
        </h1>
        <p style={{ margin: "0 0 28px", fontSize: 14, color: "var(--px-mid)", lineHeight: 1.5 }}>
          Te enviaremos un enlace para crear una nueva contraseña.
        </p>

        {error && (
          <div style={{ background: "oklch(0.96 0.05 28)", border: "1px solid oklch(0.88 0.12 28)", borderRadius: 8, padding: "10px 14px", marginBottom: 20, fontSize: 13, color: "oklch(0.40 0.18 28)" }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6, color: "var(--px-ink2)" }}>
              Email
            </label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="correo@ejemplo.com"
              style={INPUT_STYLE}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "11px",
              background: loading ? "var(--px-line)" : "var(--px-ink)",
              color: "var(--px-bone)",
              border: "none",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              fontFamily: "var(--font-inter-tight), Inter, system-ui, sans-serif",
              letterSpacing: "-0.02em",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Enviando…" : "Enviar enlace"}
          </button>
        </form>
      </div>

      <p style={{ marginTop: 24, fontSize: 14, color: "var(--px-mid)" }}>
        <Link href="/login" style={{ color: "var(--px-ink)", fontWeight: 500, textDecoration: "none" }}>
          ← Volver al inicio de sesión
        </Link>
      </p>
    </div>
  );
}

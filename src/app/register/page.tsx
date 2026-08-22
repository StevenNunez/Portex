"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }

    setLoading(true);

    const supabase = createSupabaseBrowser();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/onboarding`,
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    // If email confirmation is disabled, session is immediate
    if (data.session) {
      router.push("/onboarding");
      router.refresh();
      return;
    }

    // Email confirmation required
    setEmailSent(true);
    setLoading(false);
  }

  if (emailSent) {
    return (
      <div
        style={{
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--px-bone)",
          padding: "40px 20px",
        }}
      >
        <MarcaPortex href="/" />
        <div
          style={{
            width: "100%",
            maxWidth: 380,
            background: "white",
            border: "1px solid var(--px-line)",
            borderRadius: 16,
            padding: "40px 32px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 36, marginBottom: 20 }}>✉️</div>
          <h2
            style={{
              margin: "0 0 12px",
              fontSize: 20,
              fontWeight: 700,
              letterSpacing: "-0.03em",
            }}
          >
            Revisa tu email
          </h2>
          <p style={{ fontSize: 14, color: "var(--px-mid)", lineHeight: 1.6, margin: 0 }}>
            Te enviamos un enlace de confirmación a{" "}
            <strong style={{ color: "var(--px-ink)" }}>{email}</strong>.
            Haz clic en el enlace para activar tu cuenta.
          </p>
        </div>
        <p style={{ marginTop: 24, fontSize: 14, color: "var(--px-mid)" }}>
          ¿Ya tienes cuenta?{" "}
          <Link
            href="/login"
            style={{ color: "var(--px-ink)", fontWeight: 500, textDecoration: "none" }}
          >
            Inicia sesión
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--px-bone)",
        padding: "40px 20px",
      }}
    >
      {/* Logo */}
      <MarcaPortex href="/" />

      {/* Card */}
      <div
        style={{
          width: "100%",
          maxWidth: 400,
          background: "white",
          border: "1px solid var(--px-line)",
          borderRadius: 16,
          padding: "36px 32px",
        }}
      >
        <h1
          style={{
            margin: "0 0 6px",
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: "-0.03em",
            color: "var(--px-ink)",
          }}
        >
          Crea tu cuenta
        </h1>
        <p style={{ margin: "0 0 28px", fontSize: 14, color: "var(--px-mid)", lineHeight: 1.5 }}>
          Administra el acceso de tu condominio desde el día uno.
        </p>

        {error && (
          <div
            style={{
              background: "oklch(0.96 0.05 28)",
              border: "1px solid oklch(0.88 0.12 28)",
              borderRadius: 8,
              padding: "10px 14px",
              marginBottom: 20,
              fontSize: 13,
              color: "oklch(0.40 0.18 28)",
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                display: "block",
                fontSize: 13,
                fontWeight: 500,
                marginBottom: 6,
                color: "var(--px-ink2)",
              }}
            >
              Nombre completo
            </label>
            <input
              type="text"
              required
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="María González"
              style={INPUT_STYLE}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                display: "block",
                fontSize: 13,
                fontWeight: 500,
                marginBottom: 6,
                color: "var(--px-ink2)",
              }}
            >
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

          <div style={{ marginBottom: 28 }}>
            <label
              style={{
                display: "block",
                fontSize: 13,
                fontWeight: 500,
                marginBottom: 6,
                color: "var(--px-ink2)",
              }}
            >
              Contraseña
            </label>
            <input
              type="password"
              required
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
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
            {loading ? "Creando cuenta…" : "Crear cuenta"}
          </button>
        </form>

        <p
          style={{
            marginTop: 20,
            fontSize: 12,
            color: "var(--px-mid)",
            textAlign: "center",
            lineHeight: 1.5,
          }}
        >
          Al crear tu cuenta, aceptas nuestros{" "}
          {/* En pestaña nueva: leer los términos no debería costarle el formulario
              a medio llenar. */}
          <a
            href="/terminos"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "var(--px-mid2)", textDecoration: "underline" }}
          >
            Términos
          </a>{" "}
          y{" "}
          <a
            href="/privacidad"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "var(--px-mid2)", textDecoration: "underline" }}
          >
            Política de Privacidad
          </a>
          .
        </p>
      </div>

      <p style={{ marginTop: 24, fontSize: 14, color: "var(--px-mid)" }}>
        ¿Ya tienes cuenta?{" "}
        <Link
          href="/login"
          style={{ color: "var(--px-ink)", fontWeight: 500, textDecoration: "none" }}
        >
          Inicia sesión
        </Link>
      </p>
    </div>
  );
}

"use client";

import { useState, useSyncExternalStore, Suspense } from "react";
import type { CSSProperties } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase-browser";

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

/**
 * Supabase manda el detalle del error en el fragmento (`#error_code=…`), que
 * nunca llega al servidor. Se lee suscribiéndose a la URL en vez de copiarla a
 * un estado: así no hay un `setState` en un efecto, y el servidor renderiza sin
 * hash (que es la verdad: allá no existe).
 */
function subscribeToHash(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

function LoginPage() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const hash = useSyncExternalStore(
    subscribeToHash,
    () => window.location.hash,
    () => ""
  );

  // El error del link se deriva de la URL; el del formulario es estado propio.
  const linkError = searchParams.get("error")
    ? new URLSearchParams(hash.slice(1)).get("error_code") === "otp_expired"
      ? "El link de invitación expiró. Pide al administrador que te envíe una nueva invitación."
      : "Error al iniciar sesión. Por favor intenta de nuevo."
    : null;

  const error = formError ?? linkError;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setLoading(true);

    const supabase = createSupabaseBrowser();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setFormError(
        signInError.message === "Invalid login credentials"
          ? "Email o contraseña incorrectos."
          : signInError.message
      );
      setLoading(false);
      return;
    }

    // A dónde va cada quien lo decide /inicio en el servidor, leyendo el
    // perfil real. Acá no se reparte por rol: el navegador no es la
    // fuente de verdad de quién eres.
    //
    // Navegación completa a propósito: con router.push el servidor puede
    // atender /inicio antes de recibir la cookie de sesión recién creada
    // y devolver al login, dejando al usuario en un ciclo.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/inicio");
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
      <Link
        href="/"
        style={{
          fontWeight: 700,
          fontSize: 20,
          letterSpacing: "-0.045em",
          color: "var(--px-ink)",
          textDecoration: "none",
          marginBottom: 40,
        }}
      >
        Portex
      </Link>

      {/* Card */}
      <div
        style={{
          width: "100%",
          maxWidth: 380,
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
          Iniciar sesión
        </h1>
        <p
          style={{
            margin: "0 0 28px",
            fontSize: 14,
            color: "var(--px-mid)",
            lineHeight: 1.5,
          }}
        >
          Un solo acceso: te llevamos a tu pantalla según quién seas —
          portería, administración o tu departamento.
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

          <div style={{ marginBottom: 8 }}>
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
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={INPUT_STYLE}
            />
          </div>

          <div style={{ marginBottom: 24, textAlign: "right" }}>
            <Link
              href="/reset-password"
              style={{
                fontSize: 13,
                color: "var(--px-mid)",
                textDecoration: "none",
              }}
            >
              ¿Olvidaste tu contraseña?
            </Link>
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
            {loading ? "Ingresando…" : "Ingresar"}
          </button>
        </form>
      </div>

      {/* Footer link */}
      <p
        style={{
          marginTop: 24,
          fontSize: 14,
          color: "var(--px-mid)",
        }}
      >
        ¿No tienes cuenta?{" "}
        <Link
          href="/register"
          style={{ color: "var(--px-ink)", fontWeight: 500, textDecoration: "none" }}
        >
          Regístrate
        </Link>
      </p>
    </div>
  );
}

export default function LoginPageWrapper() {
  return (
    <Suspense>
      <LoginPage />
    </Suspense>
  );
}

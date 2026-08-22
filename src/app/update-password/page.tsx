"use client";

import { useState, useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import { syncInvitedProfile, datosDeInvitacion } from "@/app/actions";
import MarcaPortex from "@/components/MarcaPortex";

const INPUT: CSSProperties = {
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

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase = "loading" | "form" | "error";

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function UpdatePasswordPage() {
  const unsubRef = useRef<(() => void) | null>(null);

  const [phase,    setPhase]    = useState<Phase>("loading");
  const [authUser, setAuthUser] = useState<User | null>(null);

  // Derived from authUser
  const isInvited  = Boolean(authUser?.user_metadata?.organization_id);
  const nameFromMeta = authUser?.user_metadata?.full_name as string | undefined;

  const [fullName,         setFullName]         = useState("");
  const [needsName,        setNeedsName]        = useState(false);
  const [password,         setPassword]         = useState("");
  const [confirmPassword,  setConfirmPassword]  = useState("");
  const [error,            setError]            = useState<string | null>(null);
  const [loading,          setLoading]          = useState(false);
  // Con qué correo entra y a qué edificio queda ligado: sin esto la pantalla
  // parece un registro desde cero y uno no sabe si quedó dentro del condominio.
  const [contexto, setContexto] = useState<{ email: string | null; orgName: string | null; buildingName: string | null } | null>(null);

  // ── Session detection ──────────────────────────────────────────────────────
  useEffect(() => {
    const supabase = createSupabaseBrowser();

    // Clean sensitive hash from URL (implicit flow leaves tokens in the hash)
    if (window.location.hash.includes("access_token")) {
      window.history.replaceState({}, "", window.location.pathname + window.location.search);
    }

    function initUser(user: User) {
      setAuthUser(user);

      const metaName = user.user_metadata?.full_name as string | undefined;

      supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single()
        .then(({ data: profile }) => {
          if (profile?.full_name) {
            setFullName(profile.full_name);
            setNeedsName(false);
          } else if (metaName) {
            setFullName(metaName);
            setNeedsName(true);
          } else {
            setFullName("");
            setNeedsName(true);
          }
          setPhase("form");
        });

      datosDeInvitacion()
        .then((d) => setContexto({ email: d.email, orgName: d.orgName, buildingName: d.buildingName }))
        .catch(() => {});
    }

    // Fast path: session already in cookies (PKCE flow)
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) { initUser(user); return; }

      // Slow path: wait for the browser client to process the hash (implicit flow)
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user) {
          subscription.unsubscribe();
          initUser(session.user);
        }
      });
      unsubRef.current = () => subscription.unsubscribe();

      // Timeout: if nothing after 6 s, show error
      const timer = setTimeout(() => {
        subscription.unsubscribe();
        setPhase("error");
      }, 6000);

      return () => clearTimeout(timer);
    });

    return () => { unsubRef.current?.(); };
  }, []);

  // ── Form submit ────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!authUser) return;
    setError(null);

    if (password !== confirmPassword) { setError("Las contraseñas no coinciden."); return; }
    if (password.length < 6)          { setError("La contraseña debe tener al menos 6 caracteres."); return; }

    setLoading(true);
    const supabase = createSupabaseBrowser();

    // 1. Update password (and embed full_name in auth metadata)
    const { error: pwErr } = await supabase.auth.updateUser({
      password,
      data: needsName && fullName ? { full_name: fullName } : undefined,
    });

    if (pwErr) {
      setError(pwErr.message);
      setLoading(false);
      return;
    }

    // 2. Sync profile via service-role (bypasses RLS)
    if (isInvited) {
      // La organización y el rol los resuelve el servidor desde el
      // user_metadata de la invitación; acá solo va el nombre.
      const sync = await syncInvitedProfile({
        fullName: needsName && fullName ? fullName : undefined,
      });

      if (!sync.ok) {
        setError(sync.error ?? "Error al configurar tu perfil. Intenta de nuevo.");
        setLoading(false);
        return;
      }

      // Recarga completa por lo mismo que en el login: la cookie de sesión
      // recién creada tiene que llegar al servidor antes de pedir /inicio.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/inicio");
      return;
    }

    // Cambio de contraseña normal: /inicio reparte igual que en el login
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/inicio");
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const heading = isInvited ? "Configura tu cuenta" : "Actualizar contraseña";
  const subtext  = isInvited
    ? "Tu cuenta ya está creada. Elige una contraseña y entras."
    : "Ingresa tu nueva contraseña.";
  const btnLabel = loading ? "Guardando…" : isInvited ? "Entrar a Portex →" : "Guardar contraseña";

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "var(--px-bone)", padding: "40px 20px" }}>
      <MarcaPortex href="/" />

      <div style={{ width: "100%", maxWidth: 380, background: "white", border: "1px solid var(--px-line)", borderRadius: 16, padding: "36px 32px" }}>

        {/* Loading */}
        {phase === "loading" && (
          <>
            <h1 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 700, letterSpacing: "-0.03em", color: "var(--px-ink)" }}>
              Verificando…
            </h1>
            <p style={{ margin: 0, fontSize: 14, color: "var(--px-mid)" }}>
              Estamos verificando tu invitación.
            </p>
          </>
        )}

        {/* Session error */}
        {phase === "error" && (
          <>
            <h1 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 700, letterSpacing: "-0.03em", color: "var(--px-ink)" }}>
              Link inválido
            </h1>
            <p style={{ margin: "0 0 20px", fontSize: 14, color: "var(--px-mid)", lineHeight: 1.5 }}>
              Este link ya no es válido o expiró. Pide al administrador que te envíe una nueva invitación.
            </p>
            <Link href="/login" style={{ fontSize: 13, color: "var(--px-ink)", textDecoration: "underline" }}>
              Ir al inicio de sesión
            </Link>
          </>
        )}

        {/* Form */}
        {phase === "form" && (
          <>
            <h1 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 700, letterSpacing: "-0.03em", color: "var(--px-ink)" }}>
              {heading}
            </h1>
            <p style={{ margin: "0 0 20px", fontSize: 14, color: "var(--px-mid)", lineHeight: 1.5 }}>
              {subtext}
            </p>

            {/* Tu correo y tu edificio, a la vista: no te estás registrando de
                cero, la cuenta ya existe y ya está ligada al condominio. */}
            {contexto?.email && (
              <div
                style={{
                  marginBottom: 24, padding: "12px 14px", borderRadius: 9,
                  background: "var(--px-paper)", border: "1px solid var(--px-line2)",
                  display: "flex", flexDirection: "column", gap: 8,
                }}
              >
                <div>
                  <div style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 9.5, letterSpacing: "0.08em", color: "var(--px-mid2)" }}>
                    TU CUENTA
                  </div>
                  <div style={{ fontSize: 13.5, fontWeight: 500, marginTop: 2, wordBreak: "break-all" }}>
                    {contexto.email}
                  </div>
                </div>
                {(contexto.buildingName || contexto.orgName) && (
                  <div>
                    <div style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 9.5, letterSpacing: "0.08em", color: "var(--px-mid2)" }}>
                      EDIFICIO
                    </div>
                    <div style={{ fontSize: 13.5, fontWeight: 500, marginTop: 2 }}>
                      {contexto.buildingName ?? contexto.orgName}
                    </div>
                  </div>
                )}
              </div>
            )}

            {error && (
              <div style={{ background: "oklch(0.96 0.05 28)", border: "1px solid oklch(0.88 0.12 28)", borderRadius: 8, padding: "10px 14px", marginBottom: 20, fontSize: 13, color: "oklch(0.40 0.18 28)" }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {needsName && (
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6, color: "var(--px-ink2)" }}>
                    Nombre completo
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder={nameFromMeta ?? "Ej: Juan Pérez"}
                    style={INPUT}
                  />
                </div>
              )}

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6, color: "var(--px-ink2)" }}>
                  Nueva contraseña
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  style={INPUT}
                />
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6, color: "var(--px-ink2)" }}>
                  Confirmar contraseña
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  style={INPUT}
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
                {btnLabel}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

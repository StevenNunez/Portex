"use client";

import { Suspense, useState } from "react";
import type { CSSProperties } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import MarcaPortex from "@/components/MarcaPortex";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import { mensajeParaPersona } from "@/lib/errores";

/**
 * La pantalla de la invitación.
 *
 * Existe por un motivo concreto: **el enlace del correo es de un solo uso**.
 * Gmail, Outlook y los antivirus corporativos abren los enlaces de un correo
 * antes de que la persona los toque, para revisarlos. Con el enlace que trae
 * `{{ .ConfirmationURL }}` eso quemaba el token: cuando el conserje por fin
 * hacía clic, Supabase respondía `otp_expired` y terminaba en el login, sin
 * poder crear su contraseña y sin entender por qué.
 *
 * Acá el token no se gasta al abrir la página: viaja como `token_hash` y se
 * canjea recién cuando la persona aprieta el botón. Un escáner hace GET y se
 * va; el token queda intacto.
 */

const BTN: CSSProperties = {
  width: "100%",
  padding: "12px",
  background: "var(--px-ink)",
  color: "var(--px-bone)",
  border: "none",
  borderRadius: 9,
  fontSize: 14.5,
  fontWeight: 600,
  fontFamily: "var(--font-inter-tight), Inter, system-ui, sans-serif",
  letterSpacing: "-0.02em",
  cursor: "pointer",
};

const TARJETA: CSSProperties = {
  width: "100%",
  maxWidth: 400,
  background: "white",
  border: "1px solid var(--px-line)",
  borderRadius: 16,
  padding: "36px 32px",
};

const ENVOLTORIO: CSSProperties = {
  minHeight: "100dvh",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  background: "var(--px-bone)",
  padding: "40px 20px",
};

// `magiclink` es el reenvío de una invitación que nunca se abrió: la cuenta ya
// existe, así que no se puede volver a emitir un `invite`. Termina en la misma
// pantalla y con el mismo texto — para la persona es la misma invitación.
type Tipo = "invite" | "magiclink" | "recovery";

function Contenido() {
  const params = useSearchParams();

  const tokenHash = params.get("token_hash");
  const tipoCrudo = params.get("type");
  const tipo: Tipo =
    tipoCrudo === "recovery" ? "recovery" : tipoCrudo === "magiclink" ? "magiclink" : "invite";
  const email = params.get("email");
  // El callback manda para acá los enlaces que Supabase ya rechazó.
  const errorPrevio = params.get("error");

  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const esRecuperacion = tipo === "recovery";

  async function canjear() {
    if (!tokenHash) return;
    setError(null);
    setCargando(true);

    const supabase = createSupabaseBrowser();
    const { error: err } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: tipo,
    });

    if (err) {
      setError(
        /expired|invalid/i.test(err.message)
          ? "Este enlace ya se usó o venció."
          : mensajeParaPersona(err, "invitacion")
      );
      setCargando(false);
      return;
    }

    // Recarga completa y no `router.push`: la cookie de sesión recién creada
    // tiene que llegar al servidor antes de pedir la página siguiente.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/update-password");
  }

  // ── Enlace vencido, ya usado o mal formado ────────────────────────────────
  if (errorPrevio || !tokenHash) {
    return (
      <div style={ENVOLTORIO}>
        <MarcaPortex href="/" />
        <div style={TARJETA}>
          <h1 style={{ margin: "0 0 10px", fontSize: 21, fontWeight: 700, letterSpacing: "-0.03em" }}>
            Este enlace ya no sirve
          </h1>
          <p style={{ margin: "0 0 20px", fontSize: 14, color: "var(--px-mid)", lineHeight: 1.6 }}>
            Los enlaces de invitación se usan una sola vez y vencen. Pídele al
            administrador del edificio que te mande una nueva desde{" "}
            <strong style={{ color: "var(--px-ink2)", fontWeight: 500 }}>
              Configuración → Personal
            </strong>
            .
          </p>
          <p style={{ margin: 0, fontSize: 13.5, color: "var(--px-mid)", lineHeight: 1.6 }}>
            Si ya habías creado tu contraseña,{" "}
            <Link href="/login" style={{ color: "var(--px-ink)", fontWeight: 500 }}>
              inicia sesión
            </Link>
            . ¿La olvidaste?{" "}
            <Link href="/reset-password" style={{ color: "var(--px-ink)", fontWeight: 500 }}>
              Recupérala acá
            </Link>
            .
          </p>
        </div>
      </div>
    );
  }

  // ── Invitación válida: el token se canjea al apretar el botón ─────────────
  return (
    <div style={ENVOLTORIO}>
      <MarcaPortex href="/" />
      <div style={TARJETA}>
        <div style={{ textAlign: "center", marginBottom: 22 }}>
          <div
            style={{
              width: 52, height: 52, borderRadius: "50%",
              background: esRecuperacion ? "var(--px-paper)" : "oklch(0.95 0.05 145)",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              fontSize: 24,
            }}
          >
            {esRecuperacion ? "🔑" : "👋"}
          </div>
        </div>

        <h1 style={{ margin: "0 0 10px", fontSize: 21, fontWeight: 700, letterSpacing: "-0.03em", textAlign: "center" }}>
          {esRecuperacion ? "Recupera tu contraseña" : "Te invitaron a Portex"}
        </h1>

        <p style={{ margin: "0 0 6px", fontSize: 14, color: "var(--px-mid)", lineHeight: 1.6, textAlign: "center" }}>
          {esRecuperacion
            ? "Vas a elegir una contraseña nueva para tu cuenta."
            : "Tu cuenta ya está creada y ligada a tu edificio. Solo falta que elijas una contraseña."}
        </p>

        {email && (
          <div
            style={{
              margin: "18px 0 24px",
              padding: "11px 14px",
              borderRadius: 9,
              background: "var(--px-paper)",
              border: "1px solid var(--px-line2)",
              textAlign: "center",
            }}
          >
            <div style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 9.5, letterSpacing: "0.08em", color: "var(--px-mid)" }}>
              TU CUENTA
            </div>
            <div style={{ fontSize: 14, fontWeight: 500, marginTop: 3, wordBreak: "break-all" }}>
              {email}
            </div>
          </div>
        )}

        {error && (
          <div
            style={{
              background: "oklch(0.96 0.05 28)",
              border: "1px solid oklch(0.88 0.12 28)",
              borderRadius: 8,
              padding: "10px 14px",
              marginBottom: 18,
              fontSize: 13,
              color: "oklch(0.40 0.18 28)",
              lineHeight: 1.5,
            }}
          >
            {error} Pídele al administrador que te envíe una nueva invitación.
          </div>
        )}

        <button
          onClick={canjear}
          disabled={cargando}
          style={{ ...BTN, opacity: cargando ? 0.6 : 1, cursor: cargando ? "not-allowed" : "pointer" }}
        >
          {cargando ? "Un momento…" : "Crear mi contraseña →"}
        </button>
      </div>
    </div>
  );
}

export default function InvitacionPage() {
  return (
    <Suspense
      fallback={
        <div style={ENVOLTORIO}>
          <MarcaPortex href="/" />
        </div>
      }
    >
      <Contenido />
    </Suspense>
  );
}

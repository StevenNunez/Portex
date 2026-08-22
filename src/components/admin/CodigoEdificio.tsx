"use client";

import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { encode, toSvgPath } from "@/lib/qr";
import { cambiarCodigoEdificio } from "@/app/autoregistro-actions";

/**
 * El cartel del ascensor.
 *
 * Es la respuesta al problema de que ningún administrador tiene los 312
 * correos de su edificio: en vez de perseguirlos, se pega un papel y los
 * vecinos se anotan solos. El conserje confirma quién vive dónde, que es lo
 * único que un sistema no puede saber.
 *
 * El QR se dibuja acá mismo con el generador propio de Portex: el cartel se
 * imprime en la oficina de administración, muchas veces sin buena conexión.
 */

const MONO: CSSProperties = {
  fontFamily: "var(--font-jetbrains-mono)",
  fontSize: 10,
  letterSpacing: "0.08em",
  color: "var(--px-mid)",
};

function legible(codigo: string) {
  return `${codigo.slice(0, 4)}-${codigo.slice(4)}`;
}

export default function CodigoEdificio({
  codigoInicial,
  buildingName,
  appUrl,
}: {
  codigoInicial: string | null;
  buildingName: string;
  appUrl: string;
}) {
  const [codigo, setCodigo] = useState(codigoInicial);
  const [cargando, setCargando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  const enlace = codigo ? `${appUrl}/unirme/${codigo}` : "";

  const qr = useMemo(() => {
    if (!enlace) return null;
    try {
      const matriz = encode(enlace);
      return { path: toSvgPath(matriz), lado: matriz.length };
    } catch {
      // `encode` avisa en vez de dibujar un QR malo. Sin QR igual queda el
      // código para tipear, que es lo que de verdad no puede faltar.
      return null;
    }
  }, [enlace]);

  async function regenerar() {
    setCargando(true);
    setError(null);
    const res = await cambiarCodigoEdificio();
    if (!res.ok) {
      setError(res.error ?? "No se pudo cambiar el código");
      setCargando(false);
      return;
    }
    setCodigo(res.codigo ?? null);
    setConfirmando(false);
    setCargando(false);
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(enlace);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setError("No se pudo copiar. Selecciona el enlace y cópialo a mano.");
    }
  }

  function imprimir() {
    window.print();
  }

  if (!codigo) {
    return (
      <p style={{ margin: 0, fontSize: 13.5, color: "var(--px-mid)", lineHeight: 1.6 }}>
        No se pudo generar el código del edificio. Recarga la página; si sigue
        pasando, avísanos a portex@teolabs.app.
      </p>
    );
  }

  return (
    <div>
      <p style={{ margin: "0 0 18px", fontSize: 13.5, color: "var(--px-mid)", lineHeight: 1.65 }}>
        Imprime este cartel y pégalo en el ascensor o en la portería. El vecino lo
        escanea, deja su nombre y departamento, y{" "}
        <strong style={{ color: "var(--px-ink2)", fontWeight: 500 }}>el conserje aprueba</strong>{" "}
        desde su pantalla. Recién ahí se crea la cuenta.
      </p>

      {/* El cartel: es lo único que sale en el papel al imprimir. */}
      <div
        className="px-cartel"
        style={{
          display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap",
          background: "white", border: "1px solid var(--px-line)",
          borderRadius: 14, padding: "22px 24px", marginBottom: 16,
        }}
      >
        {qr && (
          <svg
            width={168}
            height={168}
            viewBox={`-2 -2 ${qr.lado + 4} ${qr.lado + 4}`}
            style={{ background: "white", borderRadius: 8, flexShrink: 0 }}
            role="img"
            aria-label={`Código QR para pedir acceso a la app de ${buildingName}`}
          >
            <rect x={-2} y={-2} width={qr.lado + 4} height={qr.lado + 4} fill="white" />
            <path d={qr.path} fill="#17130E" />
          </svg>
        )}

        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={MONO}>ACCESO A LA APP · {buildingName.toUpperCase()}</div>
          <div style={{ fontSize: 19, fontWeight: 600, letterSpacing: "-0.025em", margin: "6px 0 10px" }}>
            Escanea y pide tu acceso
          </div>
          <div style={{ fontSize: 13, color: "var(--px-mid)", marginBottom: 10, lineHeight: 1.55 }}>
            ¿No te toma el QR? Entra a <strong style={{ color: "var(--px-ink2)", fontWeight: 500 }}>{appUrl.replace(/^https?:\/\//, "")}/unirme</strong>{" "}
            y escribe este código:
          </div>
          <div
            style={{
              fontFamily: "var(--font-jetbrains-mono)", fontSize: 26, fontWeight: 700,
              letterSpacing: "0.12em", color: "var(--px-ink)",
            }}
          >
            {legible(codigo)}
          </div>
        </div>
      </div>

      {error && (
        <div
          style={{
            background: "oklch(0.96 0.05 28)", border: "1px solid oklch(0.88 0.12 28)",
            borderRadius: 8, padding: "10px 14px", marginBottom: 14,
            fontSize: 13, color: "oklch(0.40 0.18 28)",
          }}
        >
          {error}
        </div>
      )}

      <div className="px-sin-imprimir" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Boton onClick={imprimir}>Imprimir cartel</Boton>
        <Boton onClick={copiar}>{copiado ? "¡Copiado!" : "Copiar enlace"}</Boton>
        {confirmando ? (
          <>
            <Boton onClick={regenerar} peligro>
              {cargando ? "Cambiando…" : "Sí, cambiar el código"}
            </Boton>
            <Boton onClick={() => setConfirmando(false)}>Cancelar</Boton>
          </>
        ) : (
          <Boton onClick={() => setConfirmando(true)}>Cambiar código</Boton>
        )}
      </div>

      {confirmando && (
        <p style={{ margin: "12px 0 0", fontSize: 12.5, color: "var(--px-alert)", lineHeight: 1.6 }}>
          Los carteles que ya estén pegados dejan de funcionar en el acto y hay que
          reimprimirlos. Hazlo solo si el código se filtró fuera del edificio.
        </p>
      )}
    </div>
  );
}

function Boton({
  children, onClick, peligro,
}: {
  children: React.ReactNode;
  onClick: () => void;
  peligro?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "9px 14px", fontSize: 13, fontWeight: 500,
        fontFamily: "var(--font-inter-tight), Inter, system-ui, sans-serif",
        background: peligro ? "var(--px-alert)" : "white",
        color: peligro ? "white" : "var(--px-ink2)",
        border: peligro ? "none" : "1px solid var(--px-line)",
        borderRadius: 8, cursor: "pointer", whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
}

"use client";

import { useMemo, useState } from "react";
import { encode, toSvgPath } from "@/lib/qr";

/**
 * Un QR con su código de respaldo, listo para mostrar o mandar.
 *
 * Lo usan el pase de visita y la encomienda: los dos son lo mismo desde el
 * teléfono del residente —una llave que se muestra en portería— y en los dos
 * casos falla algo (la cámara de la tablet, la pantalla del visitante), por
 * eso el número grande siempre está al lado.
 *
 * El QR se dibuja acá mismo, sin pedirle una imagen a nadie: el pase se ve
 * aunque el edificio tenga mala señal.
 */

interface Props {
  /** Lo que va escrito dentro del QR. */
  contenido: string;
  /** Los seis dígitos que se dictan. */
  code: string;
  /** Texto que se comparte por WhatsApp junto con la imagen. */
  textoCompartir: string;
  /** Qué dice el botón. */
  etiquetaBoton: string;
  /** Descripción accesible del QR. */
  alt: string;
  /** Línea chica bajo el código. */
  pie?: string;
}

const MONO: React.CSSProperties = {
  fontFamily: "var(--font-jetbrains-mono)",
  fontSize: 10,
  letterSpacing: "0.08em",
  color: "var(--px-mid)",
};

/**
 * La firma que viaja en cada pase compartido.
 *
 * Cada visita que recibe un código es alguien que todavía no conoce Portex y
 * que probablemente vive en otro edificio con el mismo cuaderno en la
 * portería. El link va con la tarjeta y todo: es la publicidad más barata que
 * tenemos, y llega justo cuando la persona está viendo que el sistema
 * funciona.
 */
function firma(): string {
  const sitio = typeof window === "undefined" ? "portex.teolabs.app" : window.location.origin;
  return `\n\nEnviado con Portex — el edificio te avisa quién llega.\n${sitio}`;
}

/** "482913" → "482 913": así se dicta sin equivocarse. */
export function codigoLegible(code: string) {
  return `${code.slice(0, 3)} ${code.slice(3)}`;
}

export default function QrCodigo({
  contenido,
  code,
  textoCompartir,
  etiquetaBoton,
  alt,
  pie,
}: Props) {
  const [copiado, setCopiado] = useState(false);

  // El QR es puro cálculo sobre el contenido: mientras no cambie, no hay
  // para qué volver a armar la matriz en cada render.
  const { path, size } = useMemo(() => {
    const matriz = encode(contenido);
    return { path: toSvgPath(matriz), size: matriz.length };
  }, [contenido]);

  const mensaje = textoCompartir + firma();

  async function compartir() {
    // El menú del teléfono es el mejor camino: manda el QR como imagen y la
    // persona se lo guarda en su galería. Pero no está en todas partes —en
    // Chrome de escritorio no se pueden compartir archivos, en Firefox no hay
    // menú— así que si falla, WhatsApp.
    try {
      if (navigator.share) {
        const archivo = await comoArchivoPng(path, size, `portex-${code}.png`, code);
        if (archivo && navigator.canShare?.({ files: [archivo] })) {
          await navigator.share({ text: mensaje, files: [archivo] });
          return;
        }
        await navigator.share({ text: mensaje });
        return;
      }
    } catch (err) {
      // Cancelar el diálogo no es un error y no hay que insistirle con otra
      // ventana; cualquier otra cosa sí cae a WhatsApp.
      if ((err as { name?: string })?.name === "AbortError") return;
    }

    abrirWhatsApp();
  }

  function abrirWhatsApp() {
    window.open(`https://wa.me/?text=${encodeURIComponent(mensaje)}`, "_blank", "noopener");
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(mensaje);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      /* sin portapapeles: quedan el QR en pantalla y el código a la vista */
    }
  }

  return (
    <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
      <div
        style={{
          background: "white",
          padding: 10,
          borderRadius: 12,
          border: "1px solid var(--px-line2)",
          lineHeight: 0,
          flexShrink: 0,
        }}
      >
        <svg
          width={168}
          height={168}
          viewBox={`-2 -2 ${size + 4} ${size + 4}`}
          shapeRendering="crispEdges"
          role="img"
          aria-label={alt}
        >
          <rect x={-2} y={-2} width={size + 4} height={size + 4} fill="#ffffff" />
          <path d={path} fill="#000000" />
        </svg>
      </div>

      <div style={{ flex: 1, minWidth: 180 }}>
        <div style={MONO}>O DICTA ESTE CÓDIGO</div>
        <div
          style={{
            fontFamily: "var(--font-jetbrains-mono)",
            fontSize: 30,
            fontWeight: 500,
            letterSpacing: "0.06em",
            margin: "4px 0 10px",
          }}
        >
          {codigoLegible(code)}
        </div>
        {pie && (
          <div style={{ fontSize: 13, color: "var(--px-mid)", lineHeight: 1.5, marginBottom: 12 }}>
            {pie}
          </div>
        )}
        <button
          onClick={compartir}
          style={{
            width: "100%",
            padding: "12px",
            background: "var(--px-ink)",
            color: "var(--px-bone)",
            border: "none",
            borderRadius: 10,
            font: "inherit",
            fontSize: 14.5,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {etiquetaBoton}
        </button>

        {/* Las dos salidas de siempre, por si el menú del teléfono no aparece
            o quien recibe el pase prefiere el texto pelado. */}
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button
            onClick={abrirWhatsApp}
            style={{
              flex: 1,
              padding: "10px",
              background: "transparent",
              color: "var(--px-ink2)",
              border: "1px solid var(--px-line)",
              borderRadius: 10,
              font: "inherit",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            WhatsApp
          </button>
          <button
            onClick={copiar}
            style={{
              flex: 1,
              padding: "10px",
              background: "transparent",
              color: copiado ? "var(--px-ok)" : "var(--px-ink2)",
              border: "1px solid var(--px-line)",
              borderRadius: 10,
              font: "inherit",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            {copiado ? "✓ Copiado" : "Copiar"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Carga el logo para poder dibujarlo en el canvas. Null si no llega. */
function cargarLogo(): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    // Mismo origen: el canvas no se contamina y `toBlob` sigue funcionando.
    img.src = "/logo-portex.png";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
  });
}

/**
 * Pinta el pase como una tarjeta y lo devuelve como PNG para compartir.
 *
 * Antes se compartía el QR pelado: un cuadrado en blanco y negro que llegaba
 * por WhatsApp sin decir de dónde venía ni para qué era. Ahora va con la marca
 * arriba y el código abajo, así el visitante entiende qué recibió y de paso
 * ve Portex — que es la publicidad más barata que tenemos, porque llega justo
 * cuando alguien está comprobando que el sistema funciona.
 */
async function comoArchivoPng(
  path: string,
  size: number,
  nombre: string,
  code: string
): Promise<File | null> {
  try {
    const escala = 12;
    const margen = 4 * escala;
    const ladoQr = size * escala + margen * 2;

    const cabecera = 150;
    const pie = 132;
    const ancho = ladoQr;
    const alto = cabecera + ladoQr + pie;

    const canvas = document.createElement("canvas");
    canvas.width = ancho;
    canvas.height = alto;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, ancho, alto);

    // ── Marca ──
    const logo = await cargarLogo();
    const ladoLogo = 58;
    const centro = ancho / 2;

    if (logo) {
      ctx.drawImage(logo, centro - ladoLogo / 2, 34, ladoLogo, ladoLogo);
    }

    ctx.fillStyle = "#1E1B17";
    ctx.textAlign = "center";
    ctx.font = "700 30px 'Inter Tight', Inter, system-ui, sans-serif";
    ctx.fillText("Portex", centro, logo ? 34 + ladoLogo + 32 : 62);

    // ── QR ──
    ctx.save();
    ctx.fillStyle = "#000000";
    ctx.translate(margen, cabecera + margen);
    ctx.scale(escala, escala);
    ctx.fill(new Path2D(path));
    ctx.restore();

    // ── El código, para dictarlo cuando la cámara falla ──
    const baseY = cabecera + ladoQr;
    ctx.fillStyle = "#9A9690";
    ctx.font = "500 19px 'JetBrains Mono', ui-monospace, monospace";
    ctx.fillText("O DICTA ESTE CÓDIGO", centro, baseY + 30);

    ctx.fillStyle = "#1E1B17";
    ctx.font = "700 42px 'JetBrains Mono', ui-monospace, monospace";
    ctx.fillText(codigoLegible(code), centro, baseY + 82);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) return null;
    return new File([blob], nombre, { type: "image/png" });
  } catch {
    return null;
  }
}

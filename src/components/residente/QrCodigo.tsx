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

  async function compartir() {
    // Se comparte el QR como imagen para que la otra persona lo lleve en su
    // propio teléfono; si el navegador no sabe compartir archivos, va el
    // texto con el código, que sirve igual en la portería.
    try {
      if (navigator.share) {
        const archivo = await comoArchivoPng(path, size, `portex-${code}.png`);
        if (archivo && navigator.canShare?.({ files: [archivo] })) {
          await navigator.share({ text: textoCompartir, files: [archivo] });
          return;
        }
        await navigator.share({ text: textoCompartir });
        return;
      }
      await navigator.clipboard.writeText(textoCompartir);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      /* el usuario canceló el diálogo de compartir: no es un error */
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
          {copiado ? "✓ Copiado" : etiquetaBoton}
        </button>
      </div>
    </div>
  );
}

/** Pinta el QR en un canvas y lo devuelve como PNG para poder compartirlo. */
async function comoArchivoPng(path: string, size: number, nombre: string): Promise<File | null> {
  try {
    const escala = 12;
    const margen = 4 * escala;
    const lado = size * escala + margen * 2;

    const canvas = document.createElement("canvas");
    canvas.width = lado;
    canvas.height = lado;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, lado, lado);
    ctx.fillStyle = "#000000";
    ctx.translate(margen, margen);
    ctx.scale(escala, escala);
    ctx.fill(new Path2D(path));

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) return null;
    return new File([blob], nombre, { type: "image/png" });
  } catch {
    return null;
  }
}

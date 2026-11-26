import type { CSSProperties } from "react";

/**
 * Los bloques grises que ocupan el lugar de lo que todavía está cargando.
 * Los usan los `loading.tsx` de cada sección: la persona ve la forma de la
 * pantalla al tiro, en vez de un "Cargando…" en blanco.
 */
export function Bloque({ alto, ancho = "100%", style }: { alto: number; ancho?: number | string; style?: CSSProperties }) {
  return <div className="px-skel" aria-hidden="true" style={{ height: alto, width: ancho, ...style }} />;
}

/** Envuelve el esqueleto y le dice al lector de pantalla qué está pasando. */
export function Esqueleto({ children, style }: { children: React.ReactNode; style?: CSSProperties }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" style={style}>
      <span style={SR_ONLY}>
        Cargando…
      </span>
      {children}
    </div>
  );
}

const SR_ONLY: CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  border: 0,
};

"use client";

import type { CSSProperties } from "react";

/**
 * La barra de abajo.
 *
 * El portal era una sola lista larga: avisos, encomiendas, pases,
 * estacionamiento e historial, todo uno tras otro. Para ver si llegó un
 * paquete había que pasar por encima de todo lo demás.
 *
 * Cuatro pestañas, en el orden en que la gente las usa: lo que está pasando
 * ahora, lo que uno hace (avisar visitas), lo que es del departamento, y la
 * ficha. Abajo y con el pulgar cerca, como cualquier app del teléfono.
 */

export type Tab = "inicio" | "visitas" | "depto" | "perfil";

interface Props {
  activa: Tab;
  onCambiar: (t: Tab) => void;
  /** Cuántas cosas piden atención en Inicio: visitas esperando y paquetes. */
  pendientes: number;
}

const TABS: { id: Tab; label: string; icono: React.ReactNode }[] = [
  {
    id: "inicio",
    label: "Inicio",
    icono: (
      <svg viewBox="0 0 24 24" width={21} height={21} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 11l8-6 8 6" />
        <path d="M6 10v9h12v-9" />
      </svg>
    ),
  },
  {
    id: "visitas",
    label: "Visitas",
    icono: (
      <svg viewBox="0 0 24 24" width={21} height={21} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="3.4" />
        <path d="M5.5 19.5c0-3.3 2.9-5.5 6.5-5.5s6.5 2.2 6.5 5.5" />
      </svg>
    ),
  },
  {
    id: "depto",
    label: "Mi depto",
    icono: (
      <svg viewBox="0 0 24 24" width={21} height={21} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <rect x="5" y="3.5" width="14" height="17" rx="1.5" />
        <path d="M9 8h2M13 8h2M9 12h2M13 12h2" />
        <path d="M10.5 20.5v-3.5h3v3.5" />
      </svg>
    ),
  },
  {
    id: "perfil",
    label: "Perfil",
    icono: (
      <svg viewBox="0 0 24 24" width={21} height={21} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="4" width="16" height="16" rx="3" />
        <circle cx="12" cy="10" r="2.4" />
        <path d="M7.8 17.2c.6-2 2.2-3 4.2-3s3.6 1 4.2 3" />
      </svg>
    ),
  },
];

const BARRA: CSSProperties = {
  position: "fixed",
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: 40,
  display: "flex",
  background: "rgba(252,251,249,0.94)",
  backdropFilter: "blur(20px)",
  borderTop: "1px solid var(--px-line)",
  // El respiro de la franja inferior del iPhone: sin esto los botones quedan
  // debajo de la barra del sistema y no se pueden tocar.
  paddingBottom: "env(safe-area-inset-bottom, 0px)",
};

export default function TabsResidente({ activa, onCambiar, pendientes }: Props) {
  return (
    <nav style={BARRA}>
      {TABS.map((t) => {
        const esta = activa === t.id;
        return (
          <button
            key={t.id}
            onClick={() => onCambiar(t.id)}
            aria-current={esta ? "page" : undefined}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 3,
              padding: "10px 0 12px",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: esta ? "var(--px-ink)" : "var(--px-mid)",
              font: "inherit",
            }}
          >
            <span style={{ position: "relative", display: "flex" }}>
              {t.icono}
              {t.id === "inicio" && pendientes > 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: -3,
                    right: -6,
                    minWidth: 16,
                    height: 16,
                    padding: "0 4px",
                    borderRadius: 8,
                    background: "var(--px-mark, #E01B22)",
                    color: "white",
                    fontSize: 10,
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    lineHeight: 1,
                  }}
                >
                  {pendientes}
                </span>
              )}
            </span>
            <span style={{ fontSize: 11, fontWeight: esta ? 600 : 400, letterSpacing: "-0.01em" }}>
              {t.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

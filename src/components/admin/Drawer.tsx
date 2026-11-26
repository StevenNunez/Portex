"use client";

import { useEffect, type ReactNode, type CSSProperties } from "react";
import { atributosDeCajon } from "@/lib/drawer";

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  width?: number;
}

export const FIELD: CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  fontSize: 13,
  fontFamily: "var(--font-inter-tight), Inter, system-ui, sans-serif",
  border: "1px solid var(--px-line)",
  borderRadius: 8,
  outline: "none",
  background: "white",
  color: "var(--px-ink)",
  letterSpacing: "-0.005em",
};

export const LABEL: CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 500,
  marginBottom: 5,
  color: "var(--px-ink2)",
};

export const BTN_PRIMARY: CSSProperties = {
  width: "100%",
  padding: "10px",
  background: "var(--px-ink)",
  color: "var(--px-bone)",
  border: "none",
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 600,
  fontFamily: "var(--font-inter-tight), Inter, system-ui, sans-serif",
  letterSpacing: "-0.02em",
  cursor: "pointer",
};

export default function Drawer({ open, onClose, title, subtitle, children, width = 440 }: DrawerProps) {
  // El cajón del panel se cierra con Escape, igual que al tocar afuera. (Los
  // de portería no: ahí un toque o una tecla perdida borraría una visita a
  // medio registrar.)
  useEffect(() => {
    if (!open) return;
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [open, onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 40,
          background: "rgba(0,0,0,0.3)",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition: "opacity 0.2s",
        }}
      />

      {/* Panel */}
      <div
        {...atributosDeCajon(open, title)}
        className="px-drawer"
        style={{
          position: "fixed", top: 0, right: 0, bottom: 0, zIndex: 50,
          width,
          background: "white",
          boxShadow: "-6px 0 40px rgba(0,0,0,0.12)",
          // En porcentaje y no en píxeles: en el teléfono el panel ocupa todo
          // el ancho y `width` ya no es la medida real.
          transform: open ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.26s cubic-bezier(0.4,0,0.2,1)",
          display: "flex", flexDirection: "column",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "20px 24px 16px",
            borderBottom: "1px solid var(--px-line)",
            flexShrink: 0,
          }}
        >
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-0.025em" }}>{title}</div>
            {subtitle && (
              <div style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 10.5, color: "var(--px-mid)", marginTop: 2 }}>
                {subtitle}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            title="Cerrar"
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: "var(--px-ink2)", padding: 0, borderRadius: 8,
              width: 44, height: 44, marginRight: -10,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M3 3l10 10M13 3L3 13" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: "auto", padding: "24px", paddingBottom: "calc(24px + env(safe-area-inset-bottom, 0px))" }}>
          {children}
        </div>
      </div>
    </>
  );
}

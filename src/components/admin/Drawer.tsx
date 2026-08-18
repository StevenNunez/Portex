"use client";

import type { ReactNode, CSSProperties } from "react";

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
        style={{
          position: "fixed", top: 0, right: 0, bottom: 0, zIndex: 50,
          width,
          background: "white",
          boxShadow: "-6px 0 40px rgba(0,0,0,0.12)",
          transform: open ? "translateX(0)" : `translateX(${width}px)`,
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
            onClick={onClose}
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: "var(--px-mid)", padding: "6px", borderRadius: 6,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M3 3l10 10M13 3L3 13" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: "auto", padding: "24px" }}>
          {children}
        </div>
      </div>
    </>
  );
}

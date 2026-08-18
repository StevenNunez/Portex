import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import InteractiveLogo from "@/components/InteractiveLogo";

/**
 * Marco compartido por Términos y Privacidad.
 *
 * Los dos documentos son texto largo: lo único que importa acá es que se lean
 * cómodo (una columna angosta, buen interlineado) y que se pueda volver al
 * sitio sin usar el botón atrás del navegador.
 */

const INK = "#f8f6f2";
const INK_DIM = "rgba(248,246,242,0.62)";
const INK_FAINT = "rgba(248,246,242,0.32)";
const BORDER = "rgba(255,255,255,0.08)";
const BG = "#080808";

const MONO: CSSProperties = {
  fontFamily: "var(--font-jetbrains-mono), 'JetBrains Mono', monospace",
  fontSize: 11,
  letterSpacing: "0.1em",
  color: INK_FAINT,
  textTransform: "uppercase",
};

export function Section({ n, title, children }: { n: string; title: string; children: ReactNode }) {
  return (
    <section style={{ marginTop: 48 }}>
      <div style={{ ...MONO, marginBottom: 10 }}>{n}</div>
      <h2
        style={{
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: "-0.03em",
          lineHeight: 1.2,
          margin: "0 0 16px",
          color: INK,
        }}
      >
        {title}
      </h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>{children}</div>
    </section>
  );
}

export function P({ children }: { children: ReactNode }) {
  return <p style={{ fontSize: 15, lineHeight: 1.75, color: INK_DIM, margin: 0 }}>{children}</p>;
}

export function UL({ items }: { items: ReactNode[] }) {
  return (
    <ul style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 10 }}>
      {items.map((item, i) => (
        <li key={i} style={{ fontSize: 15, lineHeight: 1.7, color: INK_DIM }}>
          {item}
        </li>
      ))}
    </ul>
  );
}

export function Strong({ children }: { children: ReactNode }) {
  return <strong style={{ color: INK, fontWeight: 600 }}>{children}</strong>;
}

export function Mail() {
  return (
    <a href="mailto:portex@teolabs.app" style={{ color: INK, textDecoration: "underline" }}>
      portex@teolabs.app
    </a>
  );
}

export default function LegalDoc({
  title,
  intro,
  updated,
  children,
}: {
  title: string;
  intro: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        background: BG,
        color: INK,
        minHeight: "100dvh",
        fontFamily: "var(--font-inter-tight), Inter, system-ui, sans-serif",
        letterSpacing: "-0.005em",
      }}
    >
      <nav
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 24px",
          height: 60,
          borderBottom: `1px solid ${BORDER}`,
          gap: 16,
        }}
      >
        <Link
          href="/"
          style={{
            fontWeight: 700,
            fontSize: 17,
            letterSpacing: "-0.04em",
            color: INK,
            textDecoration: "none",
          }}
        >
          Portex
        </Link>
        <Link href="/" style={{ ...MONO, textDecoration: "none" }}>
          ← Volver al sitio
        </Link>
      </nav>

      <main style={{ maxWidth: 680, margin: "0 auto", padding: "72px 24px 40px" }}>
        <div style={{ ...MONO, marginBottom: 16 }}>Legal</div>
        <h1
          style={{
            fontSize: "clamp(34px, 6vw, 52px)",
            fontWeight: 700,
            letterSpacing: "-0.045em",
            lineHeight: 1.05,
            margin: "0 0 20px",
            color: INK,
          }}
        >
          {title}
        </h1>
        <p style={{ fontSize: 16, lineHeight: 1.7, color: INK_DIM, margin: "0 0 12px" }}>{intro}</p>
        <div style={{ ...MONO, letterSpacing: "0.08em" }}>Última actualización · {updated}</div>

        <div style={{ borderTop: `1px solid ${BORDER}`, marginTop: 40 }} />

        {children}

        <div
          style={{
            borderTop: `1px solid ${BORDER}`,
            marginTop: 56,
            paddingTop: 24,
            display: "flex",
            gap: 20,
            flexWrap: "wrap",
          }}
        >
          <Link href="/terminos" style={{ ...MONO, textDecoration: "none" }}>
            Términos
          </Link>
          <Link href="/privacidad" style={{ ...MONO, textDecoration: "none" }}>
            Privacidad
          </Link>
          <a href="mailto:portex@teolabs.app" style={{ ...MONO, textDecoration: "none" }}>
            Contacto
          </a>
        </div>
      </main>

      <footer
        style={{
          borderTop: `1px solid ${BORDER}`,
          padding: "28px 24px 40px",
        }}
      >
        <div
          style={{
            maxWidth: 680,
            margin: "0 auto",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <span style={{ ...MONO, textTransform: "none", letterSpacing: "0.04em" }}>
            © 2026 Portex · un producto de Teo Labs
          </span>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 14,
              color: INK_FAINT,
            }}
          >
            Desarrollado por
            <a
              href="https://www.teolabs.app"
              target="_blank"
              rel="noopener noreferrer"
              style={{ textDecoration: "none" }}
            >
              <InteractiveLogo variant="footer-small" className="text-[14px]" />
            </a>
            ®
          </span>
        </div>
      </footer>
    </div>
  );
}

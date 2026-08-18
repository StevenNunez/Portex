"use client";

import { NOTICE_LABEL, type NoticeKind } from "@/lib/avisos-tipos";

/**
 * "¿Por qué no hay agua?"
 *
 * Los avisos vigentes van arriba de todo, antes que las visitas y las
 * encomiendas: es lo que el residente está buscando cuando abre la app un
 * martes a las tres de la tarde y no le sale agua de la llave.
 */

export interface AvisoVisible {
  id: string;
  kind: NoticeKind;
  title: string;
  body: string | null;
  scope: "edificio" | "unidad";
  startsAt: string;
  endsAt: string | null;
  /** Ya está pasando (lo calcula el servidor, que es quien mira el reloj). */
  vigente: boolean;
}

const MONO: React.CSSProperties = {
  fontFamily: "var(--font-jetbrains-mono)",
  fontSize: 10,
  letterSpacing: "0.08em",
};

function hora(iso: string) {
  return new Date(iso).toLocaleTimeString("es-CL", { timeZone: "America/Santiago",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
}

function dia(iso: string) {
  const d = new Date(iso);
  const hoy = new Date();
  const manana = new Date(hoy);
  manana.setDate(hoy.getDate() + 1);
  if (d.toDateString() === hoy.toDateString()) return "hoy";
  if (d.toDateString() === manana.toDateString()) return "mañana";
  return d.toLocaleDateString("es-CL", { timeZone: "America/Santiago", weekday: "long", day: "numeric", month: "long" });
}

function cuando(a: AvisoVisible) {
  const inicio = `${dia(a.startsAt)} ${hora(a.startsAt)}`;
  if (!a.endsAt) return `desde ${inicio}`;
  const mismoDia = new Date(a.startsAt).toDateString() === new Date(a.endsAt).toDateString();
  return mismoDia
    ? `${dia(a.startsAt)} de ${hora(a.startsAt)} a ${hora(a.endsAt)}`
    : `desde ${inicio} hasta ${dia(a.endsAt)} ${hora(a.endsAt)}`;
}

export default function AvisosDelEdificio({ avisos }: { avisos: AvisoVisible[] }) {
  if (avisos.length === 0) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {avisos.map((a) => (
        <section
          key={a.id}
          style={{
            background: a.vigente ? "oklch(0.96 0.05 75)" : "white",
            border: `1px solid ${a.vigente ? "oklch(0.75 0.14 75)" : "var(--px-line)"}`,
            borderRadius: 18,
            padding: "16px 18px",
          }}
        >
          <div style={{ ...MONO, color: a.vigente ? "oklch(0.48 0.14 75)" : "var(--px-mid)" }}>
            {a.vigente ? "AHORA · " : ""}
            {NOTICE_LABEL[a.kind].toUpperCase()}
            {a.scope === "unidad" ? " · TU DEPARTAMENTO" : ""}
          </div>
          <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.02em", marginTop: 4 }}>
            {a.title}
          </div>
          {a.body && (
            <div style={{ fontSize: 14, color: "var(--px-ink2)", marginTop: 4, lineHeight: 1.5 }}>
              {a.body}
            </div>
          )}
          <div style={{ fontSize: 13, color: "var(--px-mid)", marginTop: 6 }}>{cuando(a)}</div>
        </section>
      ))}
    </div>
  );
}

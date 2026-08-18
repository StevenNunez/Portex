import { ImageResponse } from "next/og";

/**
 * La tarjeta que se ve cuando alguien manda el link por WhatsApp.
 *
 * Se genera en el servidor y no es un PNG suelto en `public/`: así no queda
 * desactualizada cuando cambia la marca ni se borra sin que nadie note que
 * el link dejó de mostrar imagen.
 */

export const alt = "Portex · Control de acceso para condominios y edificios";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const TINTA = "#080808";
const HUESO = "#F9F7F4";
const ROJO = "#E01B22";
const GRIS = "#8B867F";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: TINTA,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
        }}
      >
        {/* Marca */}
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke={HUESO} strokeWidth="1.5">
            <rect x="4" y="3" width="16" height="18" rx="1" />
            <path d="M4 14h16" />
            <g strokeWidth="1.15" strokeLinecap="round">
              <path d="M6.7 15.9h7.1" />
              <path d="M6.7 17.5h4.2" />
              <path d="M6.7 19.1h7.1" />
            </g>
            <circle cx="16.8" cy="15.9" r="1.05" fill={ROJO} stroke="none" />
          </svg>
          <div style={{ display: "flex", fontSize: 44, fontWeight: 700, color: HUESO, letterSpacing: "-0.03em" }}>
            Portex
          </div>
        </div>

        {/* Titular */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 82, fontWeight: 700, color: HUESO, letterSpacing: "-0.045em", lineHeight: 1.05 }}>
            Diez segundos
          </div>
          <div style={{ display: "flex", fontSize: 82, fontWeight: 700, color: GRIS, letterSpacing: "-0.045em", lineHeight: 1.05 }}>
            por cada ingreso
          </div>
          <div style={{ display: "flex", fontSize: 28, color: GRIS, marginTop: 26, maxWidth: 900, lineHeight: 1.4 }}>
            Control de acceso para condominios y edificios: visitas, encomiendas,
            estacionamientos y turnos, con aviso al departamento.
          </div>
        </div>

        {/* Pie */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ display: "flex", width: 10, height: 10, borderRadius: 5, background: ROJO }} />
          <div style={{ display: "flex", fontSize: 24, color: GRIS, letterSpacing: "0.06em" }}>
            PORTEX.TEOLABS.APP
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}

import { Bloque, Esqueleto } from "@/components/Esqueleto";

/** La portería mientras llegan los datos: la forma de los botones grandes, ya en su lugar. */
export default function CargandoPorteria() {
  return (
    <Esqueleto
      style={{
        minHeight: "100dvh",
        background: "var(--px-bone)",
        padding: "20px clamp(16px, 3vw, 32px)",
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <Bloque alto={44} />
      <Bloque alto={52} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14 }}>
        <Bloque alto={150} />
        <Bloque alto={150} />
        <Bloque alto={150} />
        <Bloque alto={150} />
        <Bloque alto={150} />
      </div>
      <Bloque alto={180} />
    </Esqueleto>
  );
}

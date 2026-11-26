import { Bloque, Esqueleto } from "@/components/Esqueleto";

/** El portal del residente mientras llegan los datos, con la forma del teléfono. */
export default function CargandoResidente() {
  return (
    <Esqueleto
      style={{
        minHeight: "100dvh",
        background: "var(--px-bone)",
        padding: "24px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 16,
        maxWidth: 560,
        margin: "0 auto",
      }}
    >
      <Bloque alto={28} ancho={200} />
      <Bloque alto={120} />
      <Bloque alto={88} />
      <Bloque alto={88} />
      <Bloque alto={160} />
    </Esqueleto>
  );
}

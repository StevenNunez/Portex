import { Bloque, Esqueleto } from "@/components/Esqueleto";

/** El panel mientras llegan los datos: la barra lateral ya está, esto es el contenido. */
export default function CargandoAdmin() {
  return (
    <Esqueleto style={{ padding: "32px clamp(16px, 4vw, 40px)", display: "flex", flexDirection: "column", gap: 20 }}>
      <Bloque alto={30} ancho={260} />
      <Bloque alto={16} ancho={380} style={{ maxWidth: "80%" }} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginTop: 8 }}>
        <Bloque alto={96} />
        <Bloque alto={96} />
        <Bloque alto={96} />
        <Bloque alto={96} />
      </div>
      <Bloque alto={320} style={{ marginTop: 8 }} />
    </Esqueleto>
  );
}

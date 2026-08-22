import type { Metadata } from "next";
import { edificioPorCodigo } from "@/lib/autoregistro";
import MarcaPortex from "@/components/MarcaPortex";
import FormularioAcceso from "./FormularioAcceso";

/**
 * La página del cartel del ascensor.
 *
 * La abre gente sin cuenta, desde el teléfono, parada en el hall. Tiene que
 * explicarse sola en dos líneas y pedir lo mínimo: quién eres, dónde vives y
 * a qué correo mandarte la invitación.
 *
 * Lo que **no** muestra: nombres de residentes. Este enlace está pegado en un
 * lugar público; los códigos de departamento sirven de sugerencia, pero quién
 * vive en cada uno no es información de la calle.
 */

export const revalidate = 0;

// Un enlace pegado en un ascensor no tiene nada que hacer en Google.
export const metadata: Metadata = {
  title: "Pedir acceso a la app del edificio",
  robots: { index: false, follow: false },
};

const ENVOLTORIO = {
  minHeight: "100dvh",
  display: "flex",
  flexDirection: "column" as const,
  alignItems: "center",
  justifyContent: "center",
  background: "var(--px-bone)",
  padding: "40px 20px",
};

const TARJETA = {
  width: "100%",
  maxWidth: 420,
  background: "white",
  border: "1px solid var(--px-line)",
  borderRadius: 16,
  padding: "32px 28px",
};

export default async function UnirmePage({
  params,
}: {
  params: Promise<{ codigo: string }>;
}) {
  const { codigo } = await params;
  const edificio = await edificioPorCodigo(codigo);

  if (!edificio) {
    return (
      <div style={ENVOLTORIO}>
        <MarcaPortex href="/" />
        <div style={TARJETA}>
          <h1 style={{ margin: "0 0 10px", fontSize: 21, fontWeight: 700, letterSpacing: "-0.03em" }}>
            Ese código no existe
          </h1>
          <p style={{ margin: 0, fontSize: 14, color: "var(--px-mid)", lineHeight: 1.6 }}>
            Puede que el cartel esté viejo o que se haya colado una letra al escribirlo.
            Pregúntale al conserje por el código actual del edificio.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={ENVOLTORIO}>
      <MarcaPortex href="/" />
      <div style={TARJETA}>
        <div
          style={{
            fontFamily: "var(--font-jetbrains-mono)", fontSize: 10,
            letterSpacing: "0.08em", color: "var(--px-mid)",
          }}
        >
          ACCESO DE RESIDENTES
        </div>
        <h1 style={{ margin: "6px 0 8px", fontSize: 22, fontWeight: 700, letterSpacing: "-0.03em" }}>
          {edificio.name}
        </h1>
        <p style={{ margin: "0 0 24px", fontSize: 14, color: "var(--px-mid)", lineHeight: 1.6 }}>
          Con la app autorizas visitas desde el teléfono, te avisan cuando llega una
          encomienda y ves quién entró a buscarte. Deja tus datos y la portería
          confirma que vives acá.
        </p>

        <FormularioAcceso codigo={codigo} unidades={edificio.unidades} />
      </div>

      <p
        style={{
          marginTop: 20, fontSize: 12.5, color: "var(--px-mid)",
          textAlign: "center", maxWidth: 420, lineHeight: 1.6,
        }}
      >
        Tus datos van solo a la portería de {edificio.name}. Hasta que el conserje
        confirme, no se crea ninguna cuenta.
      </p>
    </div>
  );
}

import type { Metadata } from "next";
import MarcaPortex from "@/components/MarcaPortex";
import FormularioCodigo from "./FormularioCodigo";

/**
 * Para cuando la cámara no coopera.
 *
 * El cartel del ascensor trae el QR y, debajo, el código escrito. Esta página
 * es lo que hay al final de ese "o entra a …/unirme": un solo campo para
 * tipear las ocho letras. Pasa más de lo que uno cree — teléfonos viejos,
 * ascensores oscuros, gente que le saca una foto al cartel y la escanea
 * después.
 */

export const metadata: Metadata = {
  title: "Entrar con el código del edificio",
  robots: { index: false, follow: false },
};

export default function UnirmeSinCodigoPage() {
  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--px-bone)",
        padding: "40px 20px",
      }}
    >
      <MarcaPortex href="/" />
      <div
        style={{
          width: "100%",
          maxWidth: 400,
          background: "white",
          border: "1px solid var(--px-line)",
          borderRadius: 16,
          padding: "32px 28px",
        }}
      >
        <h1 style={{ margin: "0 0 8px", fontSize: 21, fontWeight: 700, letterSpacing: "-0.03em" }}>
          El código de tu edificio
        </h1>
        <p style={{ margin: "0 0 22px", fontSize: 14, color: "var(--px-mid)", lineHeight: 1.6 }}>
          Son ocho caracteres y están en el cartel de la portería o del ascensor. Si no
          lo encuentras, pídeselo al conserje.
        </p>
        <FormularioCodigo />
      </div>
    </div>
  );
}

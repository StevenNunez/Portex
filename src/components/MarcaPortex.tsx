import Link from "next/link";
import { IconMark } from "@/components/icons";

/**
 * La marca de las pantallas de cuenta: login, registro, el asistente de
 * configuración y el enlace de invitación.
 *
 * Va el logo **arriba** del nombre, no al lado: en estas pantallas la marca
 * está sola en el centro y es lo primero que se ve, así que tiene que
 * reconocerse como logo y no como un título cualquiera. En la barra del panel,
 * donde compite con el menú, sigue yendo en línea.
 */
export default function MarcaPortex({
  href,
  marginBottom = 40,
}: {
  /** Si se pasa, la marca es un enlace. En medio del asistente no, para no
      perder lo que uno ya llenó. */
  href?: string;
  marginBottom?: number;
}) {
  const contenido = (
    <>
      <IconMark size={34} />
      <span style={{ fontWeight: 700, fontSize: 20, letterSpacing: "-0.045em" }}>
        Portex
      </span>
    </>
  );

  const estilo = {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    gap: 8,
    color: "var(--px-ink)",
    textDecoration: "none",
    marginBottom,
  };

  if (href) {
    return (
      <Link href={href} style={estilo} aria-label="Portex">
        {contenido}
      </Link>
    );
  }

  return <div style={estilo}>{contenido}</div>;
}

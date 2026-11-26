"use client";

import PantallaDeError from "@/components/PantallaDeError";

/**
 * Cuando falla hasta el layout raíz. Reemplaza al layout, así que trae su
 * propio `<html>` y `<body>` y no cuenta con `globals.css`.
 */
export default function ErrorGlobal({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="es">
      <body style={{ margin: 0, background: "#F9F7F4" }}>
        <title>Portex</title>
        <PantallaDeError error={error} retry={retry} donde="layout roto" />
      </body>
    </html>
  );
}

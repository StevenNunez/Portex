"use client";

import PantallaDeError from "@/components/PantallaDeError";

/** Cuando una página de Portex se rompe: la explica, la reporta y deja reintentar. */
export default function ErrorDePagina({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <PantallaDeError error={error} retry={retry} donde="pantalla rota" />;
}

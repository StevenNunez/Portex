"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setParkingSpotActive } from "@/app/actions";

/**
 * Saca de circulación un estacionamiento, o lo devuelve.
 *
 * Sirve para lo que pasa siempre en un edificio: se está pintando el
 * subterráneo, quedó una moto abandonada, hay una filtración. El lugar existe
 * pero no se puede usar, y la portería no debe ofrecerlo.
 */
export default function ToggleParkingSpotButton({
  spotId,
  active,
}: {
  spotId: string;
  active: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    await setParkingSpotActive(spotId, !active);
    router.refresh();
    setLoading(false);
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      style={{
        width: "100%", padding: "7px 10px", borderRadius: 8,
        fontSize: 12, fontWeight: 500,
        fontFamily: "var(--font-inter-tight), Inter, system-ui, sans-serif",
        cursor: loading ? "default" : "pointer",
        border: "1px solid var(--px-line)",
        background: "white",
        color: "var(--px-mid)",
      }}
    >
      {loading ? "…" : active ? "Marcar fuera de uso" : "Volver a habilitar"}
    </button>
  );
}

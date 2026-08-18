"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { freeParkingSession } from "@/app/actions";

/**
 * Liberar un estacionamiento a mano.
 *
 * Pide confirmación en el mismo botón —no con un `confirm()` del navegador,
 * que bloquea toda la pantalla— porque soltar el lugar equivocado deja dos
 * autos peleando por el mismo número.
 */
export default function FreeParkingButton({
  sessionId,
  code,
}: {
  sessionId: string;
  code: string;
}) {
  const router = useRouter();
  const [armed, setArmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFree() {
    setLoading(true);
    setError(null);
    const res = await freeParkingSession(sessionId);
    if (res.ok) {
      router.refresh();
    } else {
      setError(res.error ?? "No se pudo liberar");
      setArmed(false);
    }
    setLoading(false);
  }

  if (error) {
    return (
      <div style={{ fontSize: 11.5, color: "var(--px-alert)" }}>{error}</div>
    );
  }

  return (
    <button
      onClick={() => (armed ? handleFree() : setArmed(true))}
      onBlur={() => setArmed(false)}
      disabled={loading}
      style={{
        width: "100%", padding: "8px 10px", borderRadius: 8,
        fontSize: 12.5, fontWeight: 500,
        fontFamily: "var(--font-inter-tight), Inter, system-ui, sans-serif",
        cursor: loading ? "default" : "pointer",
        border: `1px solid ${armed ? "var(--px-alert)" : "var(--px-line)"}`,
        background: armed ? "var(--px-alert)" : "white",
        color: armed ? "white" : "var(--px-ink2)",
      }}
    >
      {loading ? "Liberando…" : armed ? `Confirmar: liberar ${code}` : "Liberar"}
    </button>
  );
}

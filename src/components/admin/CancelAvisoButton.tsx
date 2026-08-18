"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cancelarAviso } from "@/app/avisos-actions";

/** Se suspendió el corte, o el aviso salió con un error. */
export default function CancelAvisoButton({ id }: { id: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function cancelar() {
    setLoading(true);
    const res = await cancelarAviso(id);
    setLoading(false);
    if (res.ok) router.refresh();
  }

  return (
    <button
      onClick={cancelar}
      disabled={loading}
      style={{
        background: "white", border: "1px solid var(--px-line)", borderRadius: 8,
        padding: "6px 11px", fontSize: 12,
        fontFamily: "var(--font-inter-tight), Inter, system-ui, sans-serif",
        color: "var(--px-alert)", cursor: loading ? "default" : "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {loading ? "…" : "Cancelar"}
    </button>
  );
}

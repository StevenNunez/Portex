"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Acepta minúsculas, guiones y espacios: nadie tipea un código como se guarda. */
function normalizar(crudo: string): string {
  return crudo.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export default function FormularioCodigo() {
  const router = useRouter();
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState<string | null>(null);

  const limpio = normalizar(codigo);

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (limpio.length !== 8) {
      setError("El código tiene ocho caracteres. Revisa el cartel.");
      return;
    }
    router.push(`/unirme/${limpio}`);
  }

  return (
    <form onSubmit={enviar}>
      <input
        value={codigo}
        onChange={(e) => { setCodigo(e.target.value); setError(null); }}
        placeholder="K7M2-Q4XP"
        autoComplete="off"
        autoCapitalize="characters"
        aria-label="Código del edificio"
        style={{
          width: "100%", padding: "14px 16px",
          fontSize: 22, fontWeight: 700,
          fontFamily: "var(--font-jetbrains-mono), monospace",
          letterSpacing: "0.12em", textAlign: "center", textTransform: "uppercase",
          border: "1px solid var(--px-line)", borderRadius: 10,
          outline: "none", background: "white", color: "var(--px-ink)",
        }}
      />

      {error && (
        <div style={{ marginTop: 12, fontSize: 13, color: "var(--px-alert)", lineHeight: 1.5 }}>
          {error}
        </div>
      )}

      <button
        type="submit"
        style={{
          width: "100%", marginTop: 18, padding: "13px",
          background: "var(--px-ink)", color: "var(--px-bone)",
          border: "none", borderRadius: 10,
          fontSize: 15, fontWeight: 600,
          fontFamily: "var(--font-inter-tight), Inter, system-ui, sans-serif",
          letterSpacing: "-0.02em", cursor: "pointer",
        }}
      >
        Continuar →
      </button>
    </form>
  );
}

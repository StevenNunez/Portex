"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DashboardSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    router.push(`/admin/residentes${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`);
  }

  return (
    <form onSubmit={handleSubmit} style={{ flex: 1, minWidth: 0 }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 8, minWidth: 0,
        background: "white", border: "1px solid var(--px-line)", borderRadius: 8,
        padding: "8px 12px", fontSize: 12,
        fontFamily: "var(--font-jetbrains-mono)", color: "var(--px-mid)",
      }}>
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="var(--px-mid)" strokeWidth="1.6">
          <circle cx="5.5" cy="5.5" r="4" />
          <path d="M8.5 8.5l3 3" />
        </svg>
        <input aria-label="Buscar residente o departamento"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar residente, depto…"
          style={{
            border: "none", outline: "none", background: "transparent",
            fontSize: 12, color: "var(--px-ink)", width: "100%", minWidth: 0,
            fontFamily: "var(--font-jetbrains-mono)",
          }}
        />
      </div>
    </form>
  );
}

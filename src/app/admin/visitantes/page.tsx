import { redirect } from "next/navigation";
import { getUserContext } from "@/lib/user-context";
import { getFrequentVisitors } from "@/lib/db";
import AddVisitanteButton from "@/components/admin/AddVisitanteButton";

export const revalidate = 0;

export default async function VisitantesPage() {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");
  if (!ctx.buildingId) redirect("/onboarding");

  const rows = await getFrequentVisitors(ctx.buildingId);

  return (
    <>
      <header style={{ padding: "22px 32px 18px", borderBottom: "1px solid var(--px-line)", flexShrink: 0, background: "white" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 11, color: "var(--px-mid)", letterSpacing: "0.08em" }}>
              VISITANTES FRECUENTES · {rows.length} REGISTRADOS
            </div>
            <h1 style={{ margin: "4px 0 0", fontSize: 30, fontWeight: 600, letterSpacing: "-0.025em" }}>
              Visitantes frecuentes
            </h1>
          </div>
          <AddVisitanteButton />
        </div>
      </header>

      <div style={{ flex: 1, overflow: "auto" }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: "1.4fr 120px 1fr 100px 140px 36px",
          padding: "10px 32px",
          fontFamily: "var(--font-jetbrains-mono)", fontSize: 10,
          letterSpacing: "0.08em", color: "var(--px-mid)",
          borderBottom: "1px solid var(--px-line)", background: "var(--px-paper)",
          position: "sticky", top: 0, zIndex: 1, gap: 12, alignItems: "center",
        }}>
          <span>NOMBRE</span>
          <span>RUT</span>
          <span>MOTIVO</span>
          <span>UNIDAD</span>
          <span>ÚLTIMA VISITA</span>
          <span />
        </div>

        {rows.length === 0 ? (
          <div style={{ padding: "60px 32px", textAlign: "center", color: "var(--px-mid)", fontFamily: "var(--font-jetbrains-mono)", fontSize: 12 }}>
            Sin visitantes frecuentes registrados.
          </div>
        ) : rows.map((r, i) => (
          <div
            key={r.id}
            style={{
              display: "grid",
              gridTemplateColumns: "1.4fr 120px 1fr 100px 140px 36px",
              padding: "11px 32px", gap: 12,
              borderBottom: "1px solid var(--px-line2)",
              fontSize: 13, alignItems: "center",
              background: i % 2 ? "var(--px-paper)" : "white",
              cursor: "pointer",
            }}
          >
            <span style={{ fontWeight: 500 }}>{r.name}</span>
            <span style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 11.5, color: "var(--px-ink2)" }}>
              {r.rut ?? "—"}
            </span>
            <span style={{ color: "var(--px-mid)", fontSize: 12.5 }}>{r.reason ?? "—"}</span>
            <span style={{ fontFamily: "var(--font-jetbrains-mono)", fontWeight: 500, fontSize: 12 }}>
              {r.default_unit ?? "—"}
            </span>
            <span style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 11.5, color: "var(--px-mid)" }}>
              {r.last_seen_at
                ? new Date(r.last_seen_at).toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" })
                : "Nunca"}
            </span>
            <span style={{ color: "var(--px-mid)", textAlign: "center" }}>›</span>
          </div>
        ))}
      </div>
    </>
  );
}

import { redirect } from "next/navigation";
import { getUserContext } from "@/lib/user-context";
import { getActivityByType } from "@/lib/db";
import { startOfTodayUtc } from "@/lib/fecha";
import RegisterVehiculoButton from "@/components/admin/RegisterVehiculoButton";

export const revalidate = 0;

function fmt(d: string) {
  return new Date(d).toLocaleString("es-CL", { timeZone: "America/Santiago",
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false,
  });
}

export default async function VehiculosPage() {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");
  if (!ctx.buildingId) redirect("/onboarding");

  const rows = await getActivityByType(ctx.buildingId, ["vehicle"], 200);

  // Comparar el texto ISO contra la fecha contaba mal a partir de las 20:00
  // de Chile, cuando UTC ya cambió de día.
  const desdeMedianoche = startOfTodayUtc();
  const hoy = rows.filter((r) => r.recorded_at >= desdeMedianoche).length;

  return (
    <>
      <header style={{ padding: "22px 32px 18px", borderBottom: "1px solid var(--px-line)", flexShrink: 0, background: "white" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 11, color: "var(--px-mid)", letterSpacing: "0.08em" }}>
              VEHÍCULOS · {hoy} HOY · {rows.length} TOTAL
            </div>
            <h1 style={{ margin: "4px 0 0", fontSize: 30, fontWeight: 600, letterSpacing: "-0.025em" }}>
              Accesos vehiculares
            </h1>
          </div>
          <RegisterVehiculoButton />
        </div>
      </header>

      <div style={{ flex: 1, overflow: "auto" }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: "160px 110px 1.2fr 1fr 120px",
          padding: "10px 32px",
          fontFamily: "var(--font-jetbrains-mono)", fontSize: 10,
          letterSpacing: "0.08em", color: "var(--px-mid)",
          borderBottom: "1px solid var(--px-line)", background: "var(--px-paper)",
          position: "sticky", top: 0, zIndex: 1, gap: 12, alignItems: "center",
        }}>
          <span>FECHA Y HORA</span>
          <span>PATENTE</span>
          <span>CONDUCTOR / PROPIETARIO</span>
          <span>UNIDAD / CONTEXTO</span>
          <span>REGISTRADO POR</span>
        </div>

        {rows.length === 0 ? (
          <div style={{ padding: "60px 32px", textAlign: "center", color: "var(--px-mid)", fontFamily: "var(--font-jetbrains-mono)", fontSize: 12 }}>
            Sin accesos vehiculares registrados.
          </div>
        ) : rows.map((r, i) => (
          <div
            key={r.id}
            style={{
              display: "grid",
              gridTemplateColumns: "160px 110px 1.2fr 1fr 120px",
              padding: "11px 32px", gap: 12,
              borderBottom: "1px solid var(--px-line2)",
              fontSize: 13, alignItems: "center",
              background: i % 2 ? "var(--px-paper)" : "white",
            }}
          >
            <span style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 11.5, color: "var(--px-ink2)" }}>
              {fmt(r.recorded_at)}
            </span>
            <span style={{ fontFamily: "var(--font-jetbrains-mono)", fontWeight: 600, fontSize: 12, letterSpacing: "0.05em" }}>
              {r.plate ?? "—"}
            </span>
            <span style={{ fontWeight: 500 }}>{r.who}</span>
            <span style={{ color: "var(--px-mid)", fontSize: 12.5 }}>
              {[r.unit, r.context].filter(Boolean).join(" · ") || "—"}
            </span>
            <span style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 11.5, color: "var(--px-mid)" }}>
              {r.recorded_by ?? "—"}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

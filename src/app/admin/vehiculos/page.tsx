import type { CSSProperties } from "react";
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
      <header className="px-head">
        <div className="px-head-fila">
          <div>
            <div style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 11, color: "var(--px-mid)", letterSpacing: "0.08em" }}>
              VEHÍCULOS · {hoy} HOY · {rows.length} TOTAL
            </div>
            <h1 style={{ margin: "4px 0 0", fontWeight: 600, letterSpacing: "-0.025em" }}>
              Accesos vehiculares
            </h1>
          </div>
          <RegisterVehiculoButton />
        </div>
      </header>

      <div style={{ flex: 1, overflow: "auto" }}>
        <div className="px-tabla-head" style={{ "--cols": "160px 110px 1.2fr 1fr 120px", "--pad": "10px 32px" } as CSSProperties}>
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
            className="px-tabla-fila" style={{ "--cols": "160px 110px 1.2fr 1fr 120px", "--pad": "11px 32px", borderBottom: "1px solid var(--px-line2)", background: i % 2 ? "var(--px-paper)" : "white" } as CSSProperties}
          >
            <span data-l="FECHA Y HORA" style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 11.5, color: "var(--px-ink2)" }}>
              {fmt(r.recorded_at)}
            </span>
            <span data-l="PATENTE" style={{ fontFamily: "var(--font-jetbrains-mono)", fontWeight: 600, fontSize: 12, letterSpacing: "0.05em" }}>
              {r.plate ?? "—"}
            </span>
            <span data-l="CONDUCTOR / PROPIETARIO" style={{ fontWeight: 500 }}>{r.who}</span>
            <span data-l="UNIDAD / CONTEXTO" style={{ color: "var(--px-mid)", fontSize: 12.5 }}>
              {[r.unit, r.context].filter(Boolean).join(" · ") || "—"}
            </span>
            <span data-l="REGISTRADO POR" style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 11.5, color: "var(--px-mid)" }}>
              {r.recorded_by ?? "—"}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

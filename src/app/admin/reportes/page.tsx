import type { CSSProperties } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getUserContext } from "@/lib/user-context";
import { displayContext } from "@/lib/format";
import { getAllActivity } from "@/lib/db";
import { daysAgoInChile } from "@/lib/fecha";
import { IconArrowIn, IconArrowOut, IconParcel, IconCar } from "@/components/icons";
import ExportCsvButton from "@/components/admin/ExportCsvButton";

export const revalidate = 0;

// Períodos que se pueden pedir. El tope de filas sube con el rango para que
// "90 días" no devuelva un mes y medio recortado sin avisar.
const PERIODOS = [
  { dias: 7,  label: "7 días",  limite: 1000 },
  { dias: 30, label: "30 días", limite: 3000 },
  { dias: 90, label: "90 días", limite: 8000 },
] as const;

const TYPE_LABEL: Record<string, string> = {
  in:       "Ingreso",
  out:      "Salida",
  parcel:   "Encomienda",
  vehicle:  "Vehículo",
  delivery: "Delivery",
  provider: "Proveedor",
};

const TYPE_COLOR: Record<string, string> = {
  in:       "var(--px-ok)",
  delivery: "var(--px-ok)",
  provider: "var(--px-ok)",
  out:      "var(--px-alert)",
  parcel:   "oklch(0.55 0.14 250)",
  vehicle:  "var(--px-ink2)",
};

function DirIcon({ type }: { type: string }) {
  if (type === "out") return <IconArrowOut size={13} />;
  if (type === "parcel") return <IconParcel size={13} />;
  if (type === "vehicle") return <IconCar size={13} />;
  return <IconArrowIn size={13} />;
}

function fmt(d: string) {
  return new Date(d).toLocaleString("es-CL", { timeZone: "America/Santiago",
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false,
  });
}

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Promise<{ dias?: string }>;
}) {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");
  if (!ctx.buildingId) redirect("/onboarding");

  const { dias } = await searchParams;
  const periodo = PERIODOS.find((p) => String(p.dias) === dias) ?? PERIODOS[0];

  // Días contados en la fecha del edificio, no en UTC.
  const dateFrom = daysAgoInChile(periodo.dias);

  const rows = await getAllActivity(ctx.buildingId, periodo.limite, dateFrom);

  const counts = {
    in:      rows.filter((r) => ["in", "delivery", "provider"].includes(r.type)).length,
    out:     rows.filter((r) => r.type === "out").length,
    parcel:  rows.filter((r) => r.type === "parcel").length,
    vehicle: rows.filter((r) => r.type === "vehicle").length,
  };

  return (
    <>
      <header className="px-head">
        <div className="px-head-fila">
          <div>
            <div style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 11, color: "var(--px-mid)", letterSpacing: "0.08em" }}>
              REPORTES · ÚLTIMOS {periodo.dias} DÍAS · {rows.length} REGISTROS
              {rows.length === periodo.limite && " · TOPE ALCANZADO"}
            </div>
            <h1 style={{ margin: "4px 0 0", fontWeight: 600, letterSpacing: "-0.025em" }}>
              Bitácora de accesos
            </h1>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {/* Períodos: links, no estado de cliente — así el rango elegido
                queda en la URL y se puede compartir o marcar. */}
            <div style={{ display: "flex", border: "1px solid var(--px-line)", borderRadius: 8, overflow: "hidden" }}>
              {PERIODOS.map((p) => {
                const activo = p.dias === periodo.dias;
                return (
                  <Link
                    key={p.dias}
                    href={`/admin/reportes?dias=${p.dias}`}
                    style={{
                      padding: "9px 13px",
                      fontSize: 12.5,
                      fontWeight: activo ? 600 : 400,
                      textDecoration: "none",
                      color: activo ? "var(--px-bone)" : "var(--px-mid)",
                      background: activo ? "var(--px-ink)" : "white",
                    }}
                  >
                    {p.label}
                  </Link>
                );
              })}
            </div>

            <ExportCsvButton rows={rows} buildingName={ctx.buildingName} days={periodo.dias} />
          </div>
        </div>

        {/* Summary chips */}
        <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
          {[
            { label: "Ingresos",     value: counts.in,      color: "var(--px-ok)" },
            { label: "Salidas",      value: counts.out,     color: "var(--px-alert)" },
            { label: "Encomiendas",  value: counts.parcel,  color: "oklch(0.55 0.14 250)" },
            { label: "Vehículos",    value: counts.vehicle, color: "var(--px-ink2)" },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--px-paper)", border: "1px solid var(--px-line)", borderRadius: 8, padding: "7px 14px" }}>
              <span style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 16, fontWeight: 600, color }}>{value}</span>
              <span style={{ fontSize: 12.5, color: "var(--px-mid)" }}>{label}</span>
            </div>
          ))}
        </div>
      </header>

      <div style={{ flex: 1, overflow: "auto" }}>
        <div className="px-tabla-head" style={{ "--cols": "28px 160px 90px 1.2fr 1fr 100px 120px", "--pad": "10px 32px" } as CSSProperties}>
          <span />
          <span>FECHA Y HORA</span>
          <span>TIPO</span>
          <span>NOMBRE</span>
          <span>CONTEXTO</span>
          <span>UNIDAD</span>
          <span>REGISTRADO POR</span>
        </div>

        {rows.length === 0 ? (
          <div style={{ padding: "60px 32px", textAlign: "center", color: "var(--px-mid)", fontFamily: "var(--font-jetbrains-mono)", fontSize: 12 }}>
            Sin registros en los últimos 7 días.
          </div>
        ) : rows.map((r, i) => (
          <div
            key={r.id}
            className="px-tabla-fila" style={{ "--cols": "28px 160px 90px 1.2fr 1fr 100px 120px", "--pad": "10px 32px", borderBottom: "1px solid var(--px-line2)", background: i % 2 ? "var(--px-paper)" : "white" } as CSSProperties}
          >
            <span style={{ color: TYPE_COLOR[r.type] ?? "var(--px-mid)", display: "flex" }}>
              <DirIcon type={r.type} />
            </span>
            <span data-l="FECHA Y HORA" style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 11.5, color: "var(--px-ink2)" }}>
              {fmt(r.recorded_at)}
            </span>
            <span data-l="TIPO" style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 10.5, color: TYPE_COLOR[r.type] ?? "var(--px-mid)" }}>
              {TYPE_LABEL[r.type] ?? r.type}
            </span>
            <span data-l="NOMBRE" style={{ fontWeight: 500 }}>{r.who}</span>
            <span data-l="CONTEXTO" style={{ color: "var(--px-mid)", fontSize: 12.5, minWidth: 0 }}>
              {displayContext(r.context) ?? r.plate ?? "—"}
              {r.authorized_by && (
                <span
                  style={{
                    display: "block",
                    fontFamily: "var(--font-jetbrains-mono)",
                    fontSize: 10.5,
                    letterSpacing: "0.05em",
                    marginTop: 2,
                    color: r.authorized_by.startsWith("Sin respuesta")
                      ? "var(--px-alert)"
                      : "var(--px-ok)",
                  }}
                >
                  {r.authorized_by.toUpperCase()}
                </span>
              )}
            </span>
            <span data-l="UNIDAD" style={{ fontFamily: "var(--font-jetbrains-mono)", fontWeight: 500, fontSize: 12 }}>
              {r.unit ?? "—"}
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

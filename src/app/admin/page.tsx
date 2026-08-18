import { redirect } from "next/navigation";
import { getDashboardStats, getHourlyActivity, getTodayShifts, getRecentActivity } from "@/lib/db";
import { getUserContext } from "@/lib/user-context";
import { displayContext } from "@/lib/format";
import { IconArrowIn, IconArrowOut, IconParcel, IconCar } from "@/components/icons";
import type { ActivityRow } from "@/lib/db";
import AddResidenteButton from "@/components/admin/AddResidenteButton";
import DashboardSearch from "@/components/admin/DashboardSearch";

export const revalidate = 0;

function fmt(n: number) { return n.toLocaleString("es-CL"); }

function initials(name: string) {
  return name.split(" ").slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

function dirColor(type: string) {
  if (type === "in" || type === "delivery" || type === "provider") return "var(--px-ok)";
  if (type === "out") return "var(--px-alert)";
  return "var(--px-ink2)";
}

function DirIcon({ type, size = 14 }: { type: string; size?: number }) {
  if (type === "out") return <IconArrowOut size={size} />;
  if (type === "parcel") return <IconParcel size={size} />;
  if (type === "vehicle") return <IconCar size={size} />;
  return <IconArrowIn size={size} />;
}

function typeLabel(type: string) {
  const map: Record<string, string> = {
    in: "Ingreso", out: "Salida", parcel: "Encomienda",
    vehicle: "Vehículo", delivery: "Delivery", provider: "Proveedor",
  };
  return map[type] ?? type;
}

export default async function AdminPage() {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");
  if (!ctx.buildingId) redirect("/onboarding");

  const { buildingId } = ctx;
  const today = new Date();
  const todayLabel = today
    .toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" })
    .replace(/^./, (c) => c.toUpperCase());

  const [stats, hourly, shifts, activity] = await Promise.all([
    getDashboardStats(buildingId),
    getHourlyActivity(buildingId),
    getTodayShifts(buildingId),
    getRecentActivity(8, buildingId),
  ]);

  const maxHourly = Math.max(...hourly.map((h) => Math.max(h.ingresos, h.salidas)), 1);

  const kpis = [
    {
      label: "INGRESOS HOY",
      value: fmt(stats.ingresos),
      note: stats.salidas > 0 ? `${stats.salidas} salidas` : "sin salidas",
      color: "var(--px-ok)",
      href: "/admin/reportes",
    },
    {
      label: "RESIDENTES ACTIVOS",
      value: fmt(stats.activeResidents),
      note: stats.totalResidents - stats.activeResidents > 0
        ? `${stats.totalResidents - stats.activeResidents} pendientes`
        : `${stats.totalResidents} en padrón`,
      color: stats.totalResidents - stats.activeResidents > 0 ? "var(--px-alert)" : "var(--px-mid)",
      href: "/admin/residentes",
    },
    {
      label: "ENCOMIENDAS HOY",
      value: fmt(stats.encomiendas),
      note: stats.pendientes > 0 ? `${stats.pendientes} sin retirar` : "al día",
      color: stats.pendientes > 0 ? "var(--px-alert)" : "var(--px-ok)",
      href: "/admin/encomiendas",
    },
    {
      label: "VEHÍCULOS HOY",
      value: fmt(stats.vehiculos),
      note: stats.vehiculos > 0 ? "registrados hoy" : "sin registros",
      color: "var(--px-mid)",
      href: "/admin/vehiculos",
    },
    {
      label: "TOTAL MOVIMIENTOS",
      value: fmt(stats.ingresos + stats.salidas + stats.encomiendas + stats.vehiculos),
      note: "acumulado hoy",
      color: "var(--px-mid)",
      href: "/admin/reportes",
    },
  ];

  const activeShifts = shifts.filter((s) => s.status === "activo").length;

  return (
    <>
      {/* Header */}
      <header style={{
        padding: "22px 32px 18px",
        borderBottom: "1px solid var(--px-line)",
        display: "flex", alignItems: "flex-end", justifyContent: "space-between",
        flexShrink: 0, background: "white",
      }}>
        <div>
          <div style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 11, color: "var(--px-mid)", letterSpacing: "0.08em" }}>
            {todayLabel.toUpperCase()}
          </div>
          <h1 style={{ margin: "4px 0 0", fontSize: 30, fontWeight: 600, letterSpacing: "-0.025em" }}>
            Panel de control
          </h1>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <DashboardSearch />
          <AddResidenteButton />
        </div>
      </header>

      <div style={{ flex: 1, padding: "24px 32px", display: "flex", flexDirection: "column", gap: 20, overflow: "auto" }}>

        {/* KPI row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
          {kpis.map((k) => (
            <a
              key={k.label}
              href={k.href}
              style={{
                background: "white", border: "1px solid var(--px-line)", borderRadius: 10,
                padding: "14px 16px", textDecoration: "none", color: "inherit",
                display: "block",
              }}
            >
              <div style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 10, letterSpacing: "0.08em", color: "var(--px-mid)" }}>
                {k.label}
              </div>
              <div style={{ fontSize: 30, fontWeight: 600, letterSpacing: "-0.025em", marginTop: 2 }}>
                {k.value}
              </div>
              <div style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 11, color: k.color, marginTop: 2 }}>
                {k.note}
              </div>
            </a>
          ))}
        </div>

        {/* Chart + Shifts */}
        <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 16, minHeight: 260 }}>

          {/* Hourly bar chart */}
          <div style={{
            background: "white", border: "1px solid var(--px-line)", borderRadius: 12,
            padding: "16px 20px", display: "flex", flexDirection: "column",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>Flujo de personas</div>
                <div style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 11, color: "var(--px-mid)" }}>
                  HOY · POR HORA
                </div>
              </div>
              <div style={{ display: "flex", gap: 14, fontSize: 11, fontFamily: "var(--font-jetbrains-mono)", color: "var(--px-mid)" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: "var(--px-ok)", display: "inline-block" }} />
                  INGRESOS
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: "var(--px-alert)", display: "inline-block" }} />
                  SALIDAS
                </span>
              </div>
            </div>

            {maxHourly === 1 ? (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 11, color: "var(--px-mid)" }}>
                  Sin movimientos registrados hoy
                </span>
              </div>
            ) : (
              <div style={{ flex: 1, marginTop: 14, display: "flex", alignItems: "flex-end", gap: 6 }}>
                {hourly.map((h) => (
                  <div key={h.hour} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, height: "100%", justifyContent: "flex-end" }}>
                    <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: "85%" }}>
                      <div style={{
                        width: 13,
                        height: h.ingresos > 0 ? `${(h.ingresos / maxHourly) * 100}%` : "2px",
                        background: "var(--px-ok)", borderRadius: "3px 3px 0 0", minHeight: 2,
                      }} />
                      <div style={{
                        width: 13,
                        height: h.salidas > 0 ? `${(h.salidas / maxHourly) * 100}%` : "2px",
                        background: "var(--px-alert)", borderRadius: "3px 3px 0 0", opacity: 0.85, minHeight: 2,
                      }} />
                    </div>
                    <div style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 9.5, color: "var(--px-mid)" }}>
                      {String(h.hour).padStart(2, "0")}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Shifts */}
          <div style={{
            background: "white", border: "1px solid var(--px-line)", borderRadius: 12,
            padding: "16px 20px", display: "flex", flexDirection: "column",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>Personal en turno</div>
                <div style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 11, color: "var(--px-mid)" }}>
                  {activeShifts > 0 ? `${activeShifts} activos` : "sin turnos activos"}
                </div>
              </div>
              <a href="/admin/turnos" style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 11, color: "var(--px-mid)", textDecoration: "none" }}>
                Ver todos →
              </a>
            </div>

            {shifts.length === 0 ? (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 11, color: "var(--px-mid)", marginBottom: 8 }}>
                    Sin turnos para hoy
                  </div>
                  <a href="/admin/turnos" style={{
                    fontSize: 12, color: "var(--px-ink2)", textDecoration: "none",
                    border: "1px solid var(--px-line)", borderRadius: 6, padding: "5px 10px",
                    fontFamily: "var(--font-inter-tight), Inter, system-ui, sans-serif",
                  }}>
                    + Crear turno
                  </a>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, overflowY: "auto" }}>
                {shifts.slice(0, 5).map((s) => (
                  <div key={s.id} style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "8px 10px", borderRadius: 8,
                    background: s.status === "activo" ? "oklch(0.97 0.03 145)" : "var(--px-paper)",
                    border: `1px solid ${s.status === "activo" ? "oklch(0.88 0.07 145)" : "var(--px-line2)"}`,
                  }}>
                    <div style={{
                      width: 30, height: 30, borderRadius: 15,
                      background: s.status === "activo" ? "oklch(0.90 0.07 145)" : "var(--px-line)",
                      color: s.status === "activo" ? "oklch(0.35 0.12 145)" : "var(--px-ink2)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 11, fontWeight: 700, flexShrink: 0,
                    }}>
                      {initials(s.staff.name)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {s.staff.name}
                      </div>
                      <div style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 10, color: "var(--px-mid)" }}>
                        {s.start_time.slice(0, 5)} – {s.end_time.slice(0, 5)}
                        {s.location && ` · ${s.location}`}
                      </div>
                    </div>
                    {s.status === "activo" && (
                      <span style={{
                        width: 7, height: 7, borderRadius: "50%",
                        background: "var(--px-ok)", flexShrink: 0,
                      }} />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Activity feed */}
        <div style={{ background: "white", border: "1px solid var(--px-line)", borderRadius: 12, padding: "14px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>Última actividad</span>
            <a href="/admin/reportes" style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 11, color: "var(--px-mid)", textDecoration: "none" }}>
              Ver reportes →
            </a>
          </div>

          {activity.length === 0 ? (
            <div style={{ padding: "20px 0", fontFamily: "var(--font-jetbrains-mono)", fontSize: 12, color: "var(--px-mid)" }}>
              Sin actividad registrada hoy.
            </div>
          ) : (
            activity.map((a: ActivityRow, i: number) => (
              <div key={a.id} style={{
                display: "grid",
                gridTemplateColumns: "18px 44px 80px 1fr auto",
                alignItems: "center", gap: 12,
                padding: "9px 0",
                borderTop: i ? "1px solid var(--px-line2)" : "none",
              }}>
                <span style={{ color: dirColor(a.type), display: "flex" }}>
                  <DirIcon type={a.type} size={14} />
                </span>
                <span style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 11, color: "var(--px-mid)" }}>
                  {new Date(a.recorded_at).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", hour12: false })}
                </span>
                <span style={{
                  fontFamily: "var(--font-jetbrains-mono)", fontSize: 9.5, letterSpacing: "0.05em",
                  padding: "2px 6px", borderRadius: 4,
                  background: "var(--px-line2)", color: "var(--px-mid)",
                }}>
                  {typeLabel(a.type).toUpperCase()}
                </span>
                <div style={{ fontSize: 13, minWidth: 0 }}>
                  <span style={{ fontWeight: 500 }}>{a.who}</span>
                  {a.context && <span style={{ color: "var(--px-mid)", marginLeft: 8, fontSize: 12 }}>{displayContext(a.context)}</span>}
                </div>
                <span style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 11, color: "var(--px-ink2)", whiteSpace: "nowrap" }}>
                  {a.unit ?? "—"}
                </span>
              </div>
            ))
          )}
        </div>

      </div>
    </>
  );
}

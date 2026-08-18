import { redirect } from "next/navigation";
import { getUserContext } from "@/lib/user-context";
import { getAllShifts, getStaff } from "@/lib/db";
import { todayInChile } from "@/lib/fecha";
import AddPersonalButton from "@/components/admin/AddPersonalButton";
import AddTurnoButton from "@/components/admin/AddTurnoButton";
import StaffCard from "@/components/admin/StaffCard";

export const revalidate = 0;

const SHIFT_LABEL: Record<string, string> = {
  "mañana": "Mañana",
  "tarde": "Tarde",
  "noche": "Noche",
};

const STATUS_COLOR: Record<string, string> = {
  activo:      "var(--px-ok)",
  completado:  "var(--px-mid)",
  programado:  "oklch(0.55 0.14 250)",
  libre:       "var(--px-mid2)",
  sin_cubrir:  "var(--px-alert)",
};

const STATUS_BG: Record<string, string> = {
  activo:      "oklch(0.95 0.05 145)",
  completado:  "var(--px-line2)",
  programado:  "oklch(0.94 0.04 250)",
  libre:       "var(--px-paper)",
  sin_cubrir:  "oklch(0.95 0.05 28)",
};

function fmtDate(d: string) {
  return new Date(d + "T12:00:00").toLocaleDateString("es-CL", { timeZone: "America/Santiago",
    weekday: "short", day: "numeric", month: "short",
  });
}

function initials(name: string) {
  return name.split(" ").slice(0, 2).map((p) => p[0].toUpperCase()).join("");
}

export default async function TurnosPage() {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");
  if (!ctx.buildingId) redirect("/onboarding");

  const [shifts, staff] = await Promise.all([
    getAllShifts(ctx.buildingId),
    getStaff(ctx.buildingId),
  ]);

  const today = todayInChile();
  const activeToday = shifts.filter((s) => s.date === today && s.status === "activo").length;
  const totalToday = shifts.filter((s) => s.date === today).length;

  return (
    <>
      <header style={{ padding: "22px 32px 18px", borderBottom: "1px solid var(--px-line)", flexShrink: 0, background: "white" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 11, color: "var(--px-mid)", letterSpacing: "0.08em" }}>
              TURNOS · {activeToday} ACTIVOS · {totalToday} HOY · {staff.length} PERSONAL
            </div>
            <h1 style={{ margin: "4px 0 0", fontSize: 30, fontWeight: 600, letterSpacing: "-0.025em" }}>
              Turnos y personal
            </h1>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <AddPersonalButton />
            <AddTurnoButton staffList={staff} />
          </div>
        </div>
      </header>

      <div style={{ flex: 1, overflow: "auto", padding: "24px 32px", display: "flex", flexDirection: "column", gap: 24 }}>

        {/* Staff roster */}
        <div style={{ background: "white", border: "1px solid var(--px-line)", borderRadius: 12, padding: "16px 20px" }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>
            Personal activo · <span style={{ color: "var(--px-mid)", fontWeight: 400 }}>{staff.length} conserjes</span>
          </div>
          {staff.length === 0 ? (
            <div style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 12, color: "var(--px-mid)", padding: "12px 0" }}>
              Sin personal registrado. Invita conserjes desde Configuración.
            </div>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {staff.map((s) => (
                <StaffCard key={s.id} staff={s} />
              ))}
            </div>
          )}
        </div>

        {/* Upcoming shifts */}
        <div style={{ background: "white", border: "1px solid var(--px-line)", borderRadius: 12, padding: "0" }}>
          <div style={{ padding: "16px 20px 12px", fontSize: 14, fontWeight: 600, borderBottom: "1px solid var(--px-line2)" }}>
            Próximos turnos
          </div>
          {shifts.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", fontFamily: "var(--font-jetbrains-mono)", fontSize: 12, color: "var(--px-mid)" }}>
              Sin turnos programados.
            </div>
          ) : (
            <>
              {/* Table header */}
              <div style={{ display: "grid", gridTemplateColumns: "130px 140px 1fr 140px 110px 110px", padding: "8px 20px", fontFamily: "var(--font-jetbrains-mono)", fontSize: 10, letterSpacing: "0.08em", color: "var(--px-mid)", background: "var(--px-paper)", borderBottom: "1px solid var(--px-line2)", gap: 12 }}>
                <span>FECHA</span>
                <span>CONSERJE</span>
                <span>UBICACIÓN</span>
                <span>HORARIO</span>
                <span>TURNO</span>
                <span>ESTADO</span>
              </div>
              {shifts.map((s, i) => (
                <div
                  key={s.id}
                  style={{
                    display: "grid", gridTemplateColumns: "130px 140px 1fr 140px 110px 110px",
                    padding: "11px 20px", gap: 12,
                    borderBottom: i < shifts.length - 1 ? "1px solid var(--px-line2)" : "none",
                    fontSize: 13, alignItems: "center",
                  }}
                >
                  <span style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 11.5 }}>
                    {fmtDate(s.date)}
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 26, height: 26, borderRadius: 13, background: "var(--px-line)", color: "var(--px-ink2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 600, flexShrink: 0 }}>
                      {initials(s.staff.name)}
                    </div>
                    <span style={{ fontSize: 12.5, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.staff.name}</span>
                  </div>
                  <span style={{ color: "var(--px-mid)", fontSize: 12.5 }}>{s.location ?? "—"}</span>
                  <span style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 11.5, color: "var(--px-ink2)" }}>
                    {s.start_time.slice(0, 5)} – {s.end_time.slice(0, 5)}
                  </span>
                  <span style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 11, color: "var(--px-mid)" }}>
                    {SHIFT_LABEL[s.type] ?? s.type}
                  </span>
                  <span>
                    <span style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 10, letterSpacing: "0.06em", padding: "3px 7px", borderRadius: 4, color: STATUS_COLOR[s.status] ?? "var(--px-mid)", background: STATUS_BG[s.status] ?? "var(--px-line2)" }}>
                      {s.status.toUpperCase().replace("_", " ")}
                    </span>
                  </span>
                </div>
              ))}
            </>
          )}
        </div>

      </div>
    </>
  );
}

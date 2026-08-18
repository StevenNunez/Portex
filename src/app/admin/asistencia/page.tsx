import Link from "next/link";
import { redirect } from "next/navigation";
import { getUserContext } from "@/lib/user-context";
import { daysAgoInChile } from "@/lib/fecha";
import { formatRut } from "@/lib/rut";
import {
  formatoDuracion,
  getAttendanceSince,
  getPresentStaff,
  minutosTrabajados,
  resumenPorPersona,
} from "@/lib/asistencia";
import CloseAttendanceButton from "@/components/admin/CloseAttendanceButton";
import ExportAsistenciaCsvButton from "@/components/admin/ExportAsistenciaCsvButton";

export const revalidate = 0;

const PERIODOS = [
  { dias: 7, label: "7 días" },
  { dias: 30, label: "30 días" },
  { dias: 90, label: "90 días" },
] as const;

function hora(iso: string) {
  return new Date(iso).toLocaleTimeString("es-CL", {
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
}

function fecha(d: string) {
  return new Date(d + "T12:00:00").toLocaleDateString("es-CL", {
    weekday: "short", day: "numeric", month: "short",
  });
}

function initials(name: string) {
  return name.split(" ").slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
}

const COL = "150px 1fr 100px 100px 110px 120px 1fr";

export default async function AsistenciaPage({
  searchParams,
}: {
  searchParams: Promise<{ dias?: string }>;
}) {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");
  if (!ctx.buildingId) redirect("/onboarding");

  const { dias } = await searchParams;
  const periodo = PERIODOS.find((p) => String(p.dias) === dias) ?? PERIODOS[0];
  const desde = daysAgoInChile(periodo.dias);

  const [presentes, jornadas] = await Promise.all([
    getPresentStaff(ctx.buildingId),
    getAttendanceSince(ctx.buildingId, desde),
  ]);

  const resumen = resumenPorPersona(jornadas);
  const atrasos = jornadas.filter((j) => (j.late_minutes ?? 0) > 0).length;
  const minutosTotales = resumen.reduce((acc, r) => acc + r.minutos, 0);

  return (
    <>
      <header style={{ padding: "22px 32px 18px", borderBottom: "1px solid var(--px-line)", flexShrink: 0, background: "white" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16 }}>
          <div>
            <div style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 11, color: "var(--px-mid)", letterSpacing: "0.08em" }}>
              ASISTENCIA · {presentes.length} EN TURNO · {jornadas.length} JORNADAS · {atrasos} CON ATRASO
            </div>
            <h1 style={{ margin: "4px 0 0", fontSize: 30, fontWeight: 600, letterSpacing: "-0.025em" }}>
              Asistencia del personal
            </h1>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div style={{ display: "flex", border: "1px solid var(--px-line)", borderRadius: 8, overflow: "hidden" }}>
              {PERIODOS.map((p) => {
                const activo = p.dias === periodo.dias;
                return (
                  <Link
                    key={p.dias}
                    href={`/admin/asistencia?dias=${p.dias}`}
                    style={{
                      padding: "9px 13px", fontSize: 12.5,
                      fontWeight: activo ? 600 : 400, textDecoration: "none",
                      color: activo ? "var(--px-bone)" : "var(--px-mid)",
                      background: activo ? "var(--px-ink)" : "white",
                    }}
                  >
                    {p.label}
                  </Link>
                );
              })}
            </div>
            <ExportAsistenciaCsvButton
              rows={jornadas.map((j) => ({
                date: j.date,
                name: j.staff.name,
                role: j.staff.role,
                rut: j.staff.rut ? formatRut(j.staff.rut) : null,
                checkedIn: j.checked_in_at,
                checkedOut: j.checked_out_at,
                minutos: minutosTrabajados(j),
                late: j.late_minutes,
                early: j.early_leave_minutes,
                note: j.note,
              }))}
              buildingName={ctx.buildingName}
              days={periodo.dias}
            />
          </div>
        </div>
      </header>

      <div style={{ flex: 1, overflow: "auto", padding: "24px 32px", display: "flex", flexDirection: "column", gap: 24 }}>

        {/* ── En el edificio ahora ────────────────────────────────── */}
        <div style={{ background: "white", border: "1px solid var(--px-line)", borderRadius: 12, padding: "16px 20px" }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
            En el edificio ahora
          </div>
          <div style={{ fontSize: 13, color: "var(--px-mid)", marginBottom: presentes.length ? 14 : 0 }}>
            Jornadas abiertas. Se cierran solas cuando la persona marca su salida en portería.
          </div>

          {presentes.length === 0 ? (
            <div style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 12, color: "var(--px-mid)", padding: "12px 0" }}>
              Nadie del personal tiene jornada abierta.
            </div>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {presentes.map((p) => {
                const minutos = p.minutosDentro;
                return (
                  <div
                    key={p.id}
                    style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "12px 14px", borderRadius: 10, minWidth: 300,
                      background: "var(--px-paper)", border: "1px solid var(--px-line2)",
                    }}
                  >
                    <div style={{ width: 34, height: 34, borderRadius: 17, background: "var(--px-ok)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11.5, fontWeight: 600, flexShrink: 0 }}>
                      {initials(p.staff.name)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 500 }}>{p.staff.name}</div>
                      <div style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 10.5, color: "var(--px-mid)" }}>
                        {p.staff.role.toUpperCase()} · DESDE {hora(p.checked_in_at)} · {formatoDuracion(minutos)}
                      </div>
                    </div>
                    <CloseAttendanceButton
                      attendanceId={p.id}
                      staffName={p.staff.name}
                      checkedInAt={p.checked_in_at}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Horas por persona ───────────────────────────────────── */}
        <div style={{ background: "white", border: "1px solid var(--px-line)", borderRadius: 12 }}>
          <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid var(--px-line2)", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>
              Horas por persona · <span style={{ color: "var(--px-mid)", fontWeight: 400 }}>últimos {periodo.dias} días</span>
            </div>
            <div style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 11, color: "var(--px-mid)" }}>
              TOTAL {formatoDuracion(minutosTotales)}
            </div>
          </div>

          {resumen.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", fontFamily: "var(--font-jetbrains-mono)", fontSize: 12, color: "var(--px-mid)" }}>
              Sin jornadas en este período.
            </div>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 130px 110px 110px 130px", padding: "8px 20px", fontFamily: "var(--font-jetbrains-mono)", fontSize: 10, letterSpacing: "0.08em", color: "var(--px-mid)", background: "var(--px-paper)", borderBottom: "1px solid var(--px-line2)", gap: 12 }}>
                <span>PERSONA</span>
                <span>HORAS</span>
                <span>JORNADAS</span>
                <span>ATRASOS</span>
                <span>SIN CERRAR</span>
              </div>
              {resumen.map((r, i) => (
                <div
                  key={r.staffId}
                  style={{
                    display: "grid", gridTemplateColumns: "1fr 130px 110px 110px 130px",
                    padding: "11px 20px", gap: 12, alignItems: "center", fontSize: 13,
                    borderBottom: i < resumen.length - 1 ? "1px solid var(--px-line2)" : "none",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
                    <div style={{ width: 26, height: 26, borderRadius: 13, background: "var(--px-line)", color: "var(--px-ink2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 600, flexShrink: 0 }}>
                      {initials(r.name)}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</div>
                      <div style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 10, color: "var(--px-mid)" }}>{r.role.toUpperCase()}</div>
                    </div>
                  </div>
                  <span style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 13, fontWeight: 500 }}>
                    {formatoDuracion(r.minutos)}
                  </span>
                  <span style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 12, color: "var(--px-ink2)" }}>{r.jornadas}</span>
                  <span style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 12, color: r.atrasos > 0 ? "var(--px-alert)" : "var(--px-mid)" }}>
                    {r.atrasos > 0 ? `${r.atrasos} · ${formatoDuracion(r.minutosAtraso)}` : "—"}
                  </span>
                  <span style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 12, color: r.abiertas > 0 ? "var(--px-alert)" : "var(--px-mid)" }}>
                    {r.abiertas > 0 ? `${r.abiertas} jornada${r.abiertas > 1 ? "s" : ""}` : "—"}
                  </span>
                </div>
              ))}
            </>
          )}
        </div>

        {/* ── Detalle de jornadas ─────────────────────────────────── */}
        <div style={{ background: "white", border: "1px solid var(--px-line)", borderRadius: 12 }}>
          <div style={{ padding: "16px 20px 12px", fontSize: 14, fontWeight: 600, borderBottom: "1px solid var(--px-line2)" }}>
            Jornadas
          </div>

          {jornadas.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", fontFamily: "var(--font-jetbrains-mono)", fontSize: 12, color: "var(--px-mid)" }}>
              Todavía nadie ha marcado asistencia.
            </div>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: COL, padding: "8px 20px", fontFamily: "var(--font-jetbrains-mono)", fontSize: 10, letterSpacing: "0.08em", color: "var(--px-mid)", background: "var(--px-paper)", borderBottom: "1px solid var(--px-line2)", gap: 12 }}>
                <span>FECHA</span>
                <span>PERSONA</span>
                <span>ENTRADA</span>
                <span>SALIDA</span>
                <span>TRABAJADO</span>
                <span>ATRASO</span>
                <span>NOTA</span>
              </div>

              {jornadas.map((j, i) => {
                const minutos = minutosTrabajados(j);
                const tarde = (j.late_minutes ?? 0) > 0;
                return (
                  <div
                    key={j.id}
                    style={{
                      display: "grid", gridTemplateColumns: COL,
                      padding: "11px 20px", gap: 12, alignItems: "center", fontSize: 13,
                      borderBottom: i < jornadas.length - 1 ? "1px solid var(--px-line2)" : "none",
                    }}
                  >
                    <span style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 11.5 }}>{fecha(j.date)}</span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{j.staff.name}</div>
                      <div style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 10, color: "var(--px-mid)" }}>{j.staff.role.toUpperCase()}</div>
                    </div>
                    <span style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 12 }}>{hora(j.checked_in_at)}</span>
                    <span style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 12, color: j.checked_out_at ? "var(--px-ink)" : "var(--px-ok)" }}>
                      {j.checked_out_at ? hora(j.checked_out_at) : "en turno"}
                    </span>
                    <span style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 12, color: "var(--px-ink2)" }}>
                      {minutos == null ? "—" : formatoDuracion(minutos)}
                    </span>
                    <span style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 11, color: tarde ? "var(--px-alert)" : "var(--px-mid)" }}>
                      {j.late_minutes == null ? "sin turno" : tarde ? `${j.late_minutes} min` : "puntual"}
                    </span>
                    <span style={{ fontSize: 12, color: "var(--px-mid)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {j.note ?? (j.early_leave_minutes ? `Salió ${j.early_leave_minutes} min antes` : "—")}
                    </span>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
    </>
  );
}

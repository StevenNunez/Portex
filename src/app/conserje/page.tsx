import { redirect } from "next/navigation";
import TapTileScreen from "@/components/conserje/TapTileScreen";
import { getRecentActivity, getResidents, getFrequentVisitors } from "@/lib/db";
import { getPendingParcels } from "@/lib/encomiendas";
import { getUserContext } from "@/lib/user-context";
import { getApprovedAwaitingEntry } from "@/lib/citofono";
import { getParkingSummary } from "@/lib/parking";
import { getPresentStaff } from "@/lib/asistencia";
import { getActiveNotices } from "@/lib/avisos";
import { registerConserjeArrival } from "@/app/actions";
import type { ActivityItem, Resident, FrequentVisitor } from "@/lib/mock-data";

export const revalidate = 0;

export default async function ConserjeHomePage() {
  const ctx = await getUserContext();

  if (!ctx) redirect("/login");
  // La portería es del conserje. El administrador puede mirarla para
  // supervisar; un residente no tiene nada que hacer acá.
  if (ctx.role !== "conserje" && ctx.role !== "admin") redirect("/inicio");
  if (!ctx.buildingId) redirect("/onboarding");

  // Register the conserje's arrival for today (idempotent — safe to call on every load)
  await registerConserjeArrival();

  const { buildingId, staffName } = ctx;

  const [activityRows, todayRows, residentRows, freqRows, pendingParcelRows, approvedRows, parkingSummary, presentStaff, avisos] = await Promise.all([
    getRecentActivity(20, buildingId),          // feed de actividad reciente (strip inferior)
    getRecentActivity(200, buildingId),         // lista completa del día para SalidaDrawer
    getResidents(buildingId),
    getFrequentVisitors(buildingId),
    getPendingParcels(buildingId),
    getApprovedAwaitingEntry(buildingId),        // autorizadas que quedaron sin registrar
    getParkingSummary(buildingId),               // null si el edificio no usa el módulo
    getPresentStaff(buildingId),                 // personal con jornada abierta
    getActiveNotices(buildingId),                // cortes y trabajos del día
  ]);


  function toActivityItem(r: (typeof activityRows)[0]): ActivityItem {
    return {
      id: r.id,
      t: new Date(r.recorded_at).toLocaleTimeString("es-CL", { timeZone: "America/Santiago",
        hour: "2-digit", minute: "2-digit", hour12: false,
      }),
      dir: r.type,
      who: r.who,
      ctx: r.context ?? "",
      unit: r.unit ?? "",
      plate: r.plate,
      by: r.recorded_by ?? "",
    };
  }

  const activity: ActivityItem[]     = activityRows.map(toActivityItem);
  const todayActivity: ActivityItem[] = todayRows.map(toActivityItem);

  const residents: Resident[] = residentRows.map((r) => ({
    id: r.id,
    unit: r.unit_code,
    name: r.name,
    household: r.household,
    tags: r.tags,
  }));

  const frequentVisitors: FrequentVisitor[] = freqRows.map((v) => ({
    id: v.id,
    name: v.name,
    rut: v.rut,
    reason: v.reason,
    unit: v.default_unit,
    last: v.last_seen_at
      ? new Date(v.last_seen_at).toLocaleDateString("es-CL", { timeZone: "America/Santiago", day: "numeric", month: "short" })
      : null,
  }));

  const residentByUnit = new Map(residentRows.map((r) => [r.unit_code, r.name]));

  // El código de retiro no viaja al navegador de la portería: el conserje
  // lo comprueba contra el servidor, no lo lee.
  const pendingParcels = pendingParcelRows.map((p) => ({
    id: p.id,
    who: p.courier ?? "Encomienda",
    unit: p.unit_code,
    context: p.description,
    recorded_at: p.received_at,
    residentName: p.unit_code ? (residentByUnit.get(p.unit_code) ?? null) : null,
  }));

  return (
    <TapTileScreen
      initialActivity={activity}
      initialTodayActivity={todayActivity}
      initialPendingParcels={pendingParcels}
      residents={residents}
      frequentVisitors={frequentVisitors}
      staffName={staffName}
      buildingName={ctx.buildingName ?? undefined}
      parkingSummary={parkingSummary}
      avisos={avisos.map((a) => ({
        id: a.id,
        kind: a.kind,
        title: a.title,
        unitCode: a.unit_code,
        scope: a.scope,
        endsAt: a.ends_at,
        vigente: a.vigente,
      }))}
      initialPresentStaff={presentStaff.map((a) => ({
        id: a.id,
        name: a.staff.name,
        role: a.staff.role,
        since: a.checked_in_at,
      }))}
      initialApproved={approvedRows.map((r) => ({
        id: r.id,
        visitorName: r.visitor_name,
        unitCode: r.unit_code,
        respondedBy: r.responded_by_name,
        respondedAt: r.responded_at,
      }))}
    />
  );
}

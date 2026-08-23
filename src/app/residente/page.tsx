import { redirect } from "next/navigation";
import { getUserContext } from "@/lib/user-context";
import {
  getResidentIdsForProfile,
  getPendingRequestsForResidents,
  getRecentRequestsForResidents,
  getPassesForResident,
  getLlegadasParaUnidades,
} from "@/lib/citofono";
import { getSpotsForUnit, getVehiclesForResidents } from "@/lib/parking";
import { getParcelsForUnit } from "@/lib/encomiendas";
import { getActiveNotices } from "@/lib/avisos";
import { getPerfil } from "@/lib/perfil";
import ResidenteHome from "@/components/residente/ResidenteHome";

export const revalidate = 0;

export default async function ResidentePage() {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");

  const units = await getResidentIdsForProfile(ctx.userId);

  // Cuenta de residente sin unidad asignada: no puede aprobar nada
  // hasta que el administrador la vincule.
  if (units.length === 0) {
    return (
      <main
        style={{
          minHeight: "100dvh",
          background: "var(--px-bone)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 32,
          fontFamily: "var(--font-inter-tight), Inter, system-ui, sans-serif",
        }}
      >
        <div style={{ maxWidth: 360, textAlign: "center" }}>
          <div style={{ fontWeight: 700, fontSize: 22, letterSpacing: "-0.03em", marginBottom: 10 }}>
            Tu cuenta todavía no está ligada a un departamento
          </div>
          <p style={{ fontSize: 14.5, color: "var(--px-mid)", lineHeight: 1.55, margin: 0 }}>
            Pídele al administrador del condominio que te vincule a tu unidad. Después de eso vas a
            poder autorizar visitas desde acá.
          </p>
        </div>
      </main>
    );
  }

  const residentIds = units.map((u) => u.residentId);

  const unitCodes = units.map((u) => u.unitCode);

  const [pending, recent, passes, spots, vehicles, parcels, avisos, perfil, llegadas] = await Promise.all([
    getPendingRequestsForResidents(residentIds),
    getRecentRequestsForResidents(residentIds, 15),
    getPassesForResident(residentIds[0]),
    // El estacionamiento y los autos son del departamento, no de la persona:
    // si la cuenta está ligada a más de una unidad, se muestra la primera.
    ctx.buildingId ? getSpotsForUnit(ctx.buildingId, units[0].unitCode) : Promise.resolve([]),
    ctx.buildingId ? getVehiclesForResidents(ctx.buildingId, residentIds) : Promise.resolve([]),
    ctx.buildingId ? getParcelsForUnit(ctx.buildingId, units[0].unitCode) : Promise.resolve([]),
    ctx.buildingId ? getActiveNotices(ctx.buildingId, units[0].unitCode) : Promise.resolve([]),
    getPerfil(units[0].residentId),
    // Quién entró y salió por su departamento: el registro que el residente
    // no tenía y que es la razón de ser de la app.
    ctx.buildingId ? getLlegadasParaUnidades(ctx.buildingId, unitCodes, 20) : Promise.resolve([]),
  ]);


  return (
    <ResidenteHome
      staffName={ctx.staffName}
      buildingName={ctx.buildingName}
      units={units}
      initialPending={pending}
      recent={recent}
      llegadas={llegadas}
      passes={passes.filter((p) => p.status === "activo")}
      vapidPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""}
      parkingSpots={spots}
      vehicles={vehicles}
      perfil={perfil}
      avisos={avisos.map((a) => ({
        id: a.id,
        kind: a.kind,
        title: a.title,
        body: a.body,
        scope: a.scope,
        startsAt: a.starts_at,
        endsAt: a.ends_at,
        vigente: a.vigente,
      }))}
      encomiendas={parcels.map((p) => ({
        id: p.id,
        courier: p.courier,
        description: p.description,
        code: p.code,
        token: p.token,
        status: p.status,
        receivedAt: p.received_at,
        pickedUpAt: p.picked_up_at,
        pickedUpBy: p.picked_up_by,
        pickupMethod: p.pickup_method,
      }))}
    />
  );
}

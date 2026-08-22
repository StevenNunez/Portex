import { redirect } from "next/navigation";
import { getUserContext } from "@/lib/user-context";
import { getParkingMap } from "@/lib/parking";
import AddParkingSpotButton from "@/components/admin/AddParkingSpotButton";
import FreeParkingButton from "@/components/admin/FreeParkingButton";
import ToggleParkingSpotButton from "@/components/admin/ToggleParkingSpotButton";

export const revalidate = 0;

/** Hace cuánto está ahí el auto — lo que delata al que se quedó de más. */
function desde(iso: string): string {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 60) return `${Math.max(min, 0)} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h`;
  const d = Math.floor(h / 24);
  return `${d} ${d === 1 ? "día" : "días"}`;
}

export default async function EstacionamientosPage() {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");
  if (!ctx.buildingId) redirect("/onboarding");

  const spots = await getParkingMap(ctx.buildingId);

  const activos = spots.filter((s) => s.active);
  const ocupados = activos.filter((s) => s.session).length;
  const libres = activos.length - ocupados;
  const deVisita = activos.filter((s) => s.kind === "visita");
  const visitaLibres = deVisita.filter((s) => !s.session).length;
  // Los prestados por sus dueños suman a los cupos que la portería puede dar.
  const prestados = activos.filter((s) => s.lent).length;

  return (
    <>
      <header className="px-head">
        <div className="px-head-fila">
          <div>
            <div style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 11, color: "var(--px-mid)", letterSpacing: "0.08em" }}>
              ESTACIONAMIENTOS · {libres} LIBRES DE {activos.length}
              {deVisita.length > 0 && ` · ${visitaLibres} DE VISITA`}
              {prestados > 0 && ` · ${prestados} PRESTADO${prestados === 1 ? "" : "S"}`}
            </div>
            <h1 style={{ margin: "4px 0 0", fontWeight: 600, letterSpacing: "-0.025em" }}>
              Estacionamientos
            </h1>
          </div>
          <AddParkingSpotButton />
        </div>
      </header>

      <div style={{ flex: 1, overflow: "auto", padding: spots.length === 0 ? 0 : "20px 32px 40px" }}>
        {spots.length === 0 ? (
          <div style={{ padding: "80px 32px", textAlign: "center", maxWidth: 460, margin: "0 auto" }}>
            <div style={{ fontSize: 19, fontWeight: 600, letterSpacing: "-0.02em", marginBottom: 8 }}>
              Todavía no hay estacionamientos cargados
            </div>
            <p style={{ fontSize: 14, color: "var(--px-mid)", lineHeight: 1.6, margin: 0 }}>
              Agrega los del edificio —los de cada departamento y los de visita— y la
              portería empieza a proponerlos sola cuando llega una visita en auto.
              Mientras no haya ninguno, el conserje no ve nada distinto.
            </p>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))",
              gap: 12,
            }}
          >
            {spots.map((spot) => {
              const ocupado = !!spot.session;
              const inactivo = !spot.active;
              // Prestado por su dueño: cuenta como cupo de visita mientras dure.
              const prestado = spot.lent;

              return (
                <div
                  key={spot.id}
                  style={{
                    background: "white",
                    border: `1px solid ${ocupado ? "var(--px-alert)" : "var(--px-line)"}`,
                    borderRadius: 12,
                    padding: "14px 16px",
                    opacity: inactivo ? 0.55 : 1,
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    minHeight: 128,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 19, fontWeight: 600, letterSpacing: "-0.02em" }}>
                      {spot.code}
                    </span>
                    <span
                      style={{
                        fontFamily: "var(--font-jetbrains-mono)", fontSize: 9,
                        letterSpacing: "0.08em", padding: "3px 7px", borderRadius: 4,
                        background: prestado ? "oklch(0.95 0.05 150)" : "var(--px-paper)",
                        border: `1px solid ${prestado ? "var(--px-ok)" : "var(--px-line2)"}`,
                        color: prestado ? "var(--px-ok)" : "var(--px-mid)",
                      }}
                    >
                      {inactivo
                        ? "FUERA DE USO"
                        : spot.kind === "visita"
                          ? "VISITA"
                          : prestado
                            ? `${spot.unit_code} · PRESTADO`
                            : spot.unit_code}
                    </span>
                  </div>

                  {ocupado && spot.session ? (
                    <>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 14, fontWeight: 600, letterSpacing: "0.04em" }}>
                          {spot.session.plate}
                        </div>
                        <div style={{ fontSize: 12.5, color: "var(--px-mid)", marginTop: 2 }}>
                          {spot.session.driver_name ?? "Sin nombre"}
                          {spot.session.unit_code ? ` · ${spot.session.unit_code}` : ""}
                        </div>
                        <div style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 10, color: "var(--px-alert)", marginTop: 4, letterSpacing: "0.06em" }}>
                          HACE {desde(spot.session.started_at).toUpperCase()}
                        </div>
                      </div>
                      <FreeParkingButton sessionId={spot.session.id} code={spot.code} />
                    </>
                  ) : (
                    <>
                      <div style={{ flex: 1 }}>
                        <span style={{ fontSize: 13.5, color: inactivo ? "var(--px-mid2)" : "var(--px-ok)", fontWeight: 500 }}>
                          {inactivo ? "No disponible" : "Libre"}
                        </span>
                        {prestado && (
                          <div style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 10, color: "var(--px-mid)", marginTop: 3 }}>
                            HASTA EL {new Date(spot.lent_until as string).toLocaleDateString("es-CL", { timeZone: "America/Santiago", day: "numeric", month: "short" }).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <ToggleParkingSpotButton spotId={spot.id} active={spot.active} />
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

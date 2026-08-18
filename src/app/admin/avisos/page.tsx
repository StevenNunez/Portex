import { redirect } from "next/navigation";
import { getUserContext } from "@/lib/user-context";
import { getNotices } from "@/lib/avisos";
import { NOTICE_LABEL } from "@/lib/avisos-tipos";
import { getResidents } from "@/lib/db";
import AddAvisoButton from "@/components/admin/AddAvisoButton";
import CancelAvisoButton from "@/components/admin/CancelAvisoButton";

export const revalidate = 0;

function fmt(iso: string) {
  return new Date(iso).toLocaleString("es-CL", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false,
  });
}

const COL = "150px 1fr 170px 190px 130px 110px";

export default async function AvisosPage() {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");
  if (!ctx.buildingId) redirect("/onboarding");

  const [avisos, residentes] = await Promise.all([
    getNotices(ctx.buildingId),
    getResidents(ctx.buildingId),
  ]);

  const vigentes = avisos.filter((a) => a.vigente).length;
  const unidades = Array.from(new Set(residentes.map((r) => r.unit_code))).sort();

  return (
    <>
      <header style={{ padding: "22px 32px 18px", borderBottom: "1px solid var(--px-line)", flexShrink: 0, background: "white" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16 }}>
          <div>
            <div style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 11, color: "var(--px-mid)", letterSpacing: "0.08em" }}>
              AVISOS · {vigentes} ACTIVOS · {avisos.length} EN TOTAL
            </div>
            <h1 style={{ margin: "4px 0 0", fontSize: 30, fontWeight: 600, letterSpacing: "-0.025em" }}>
              Avisos del edificio
            </h1>
          </div>
          <AddAvisoButton unidades={unidades} />
        </div>
        <div style={{ fontSize: 13, color: "var(--px-mid)", marginTop: 10, maxWidth: 620, lineHeight: 1.5 }}>
          Cortes de agua, ascensor en mantención, fumigación. Llegan al teléfono de los
          residentes y quedan a la vista en la portería mientras duran. Los que dicen
          “portería” los generó el conserje al registrar al proveedor que vino a hacer el trabajo.
        </div>
      </header>

      <div style={{ flex: 1, overflow: "auto" }}>
        {avisos.length === 0 ? (
          <div style={{ padding: 60, textAlign: "center", fontFamily: "var(--font-jetbrains-mono)", fontSize: 12, color: "var(--px-mid)" }}>
            Todavía no hay avisos publicados.
          </div>
        ) : (
          <>
            <div style={{
              display: "grid", gridTemplateColumns: COL, padding: "10px 32px",
              fontFamily: "var(--font-jetbrains-mono)", fontSize: 10, letterSpacing: "0.08em",
              color: "var(--px-mid)", borderBottom: "1px solid var(--px-line)",
              background: "var(--px-paper)", position: "sticky", top: 0, zIndex: 1, gap: 12,
            }}>
              <span>TIPO</span>
              <span>AVISO</span>
              <span>ALCANCE</span>
              <span>CUÁNDO</span>
              <span>ESTADO</span>
              <span></span>
            </div>

            {avisos.map((a, i) => {
              const activo = a.vigente;
              const terminado = a.terminado;

              return (
                <div
                  key={a.id}
                  style={{
                    display: "grid", gridTemplateColumns: COL, gap: 12, alignItems: "center",
                    padding: "13px 32px", fontSize: 13,
                    borderBottom: i < avisos.length - 1 ? "1px solid var(--px-line2)" : "none",
                    background: activo ? "oklch(0.98 0.02 75)" : "white",
                  }}
                >
                  <span style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 11 }}>
                    {NOTICE_LABEL[a.kind].toUpperCase()}
                  </span>

                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 500, fontSize: 13.5 }}>{a.title}</div>
                    {a.body && (
                      <div style={{ fontSize: 12.5, color: "var(--px-mid)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {a.body}
                      </div>
                    )}
                  </div>

                  <span style={{ fontSize: 12.5, color: "var(--px-ink2)" }}>
                    {a.scope === "edificio" ? "Todo el edificio" : a.unit_code}
                    <span style={{ color: "var(--px-mid)" }}>
                      {a.source === "porteria" ? " · portería" : ""}
                    </span>
                  </span>

                  <span style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 11, color: "var(--px-ink2)" }}>
                    {fmt(a.starts_at)}
                    {a.ends_at ? ` → ${fmt(a.ends_at)}` : ""}
                  </span>

                  <span>
                    <span style={{
                      fontFamily: "var(--font-jetbrains-mono)", fontSize: 10, letterSpacing: "0.06em",
                      padding: "3px 7px", borderRadius: 4,
                      color: a.cancelled_at ? "var(--px-alert)" : activo ? "oklch(0.48 0.14 75)" : "var(--px-mid)",
                      background: a.cancelled_at ? "oklch(0.96 0.05 28)" : activo ? "oklch(0.95 0.06 75)" : "var(--px-line2)",
                    }}>
                      {a.cancelled_at ? "CANCELADO" : activo ? "ACTIVO" : terminado ? "TERMINADO" : "PROGRAMADO"}
                    </span>
                  </span>

                  <span>
                    {!a.cancelled_at && !terminado && <CancelAvisoButton id={a.id} />}
                  </span>
                </div>
              );
            })}
          </>
        )}
      </div>
    </>
  );
}

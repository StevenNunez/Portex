import type { CSSProperties } from "react";
import { redirect } from "next/navigation";
import { getUserContext } from "@/lib/user-context";
import { getNotices } from "@/lib/avisos";
import { NOTICE_LABEL } from "@/lib/avisos-tipos";
import { getResidents } from "@/lib/db";
import AddAvisoButton from "@/components/admin/AddAvisoButton";
import CancelAvisoButton from "@/components/admin/CancelAvisoButton";

export const revalidate = 0;

function fmt(iso: string) {
  return new Date(iso).toLocaleString("es-CL", { timeZone: "America/Santiago",
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
      <header className="px-head">
        <div className="px-head-fila">
          <div>
            <div style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 11, color: "var(--px-mid)", letterSpacing: "0.08em" }}>
              AVISOS · {vigentes} ACTIVOS · {avisos.length} EN TOTAL
            </div>
            <h1 style={{ margin: "4px 0 0", fontWeight: 600, letterSpacing: "-0.025em" }}>
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
            <div className="px-tabla-head" style={{ "--cols": COL, "--pad": "10px 32px" } as CSSProperties}>
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
                  className="px-tabla-fila" style={{ "--cols": COL, "--pad": "13px 32px", borderBottom: i < avisos.length - 1 ? "1px solid var(--px-line2)" : "none", background: activo ? "oklch(0.98 0.02 75)" : "white" } as CSSProperties}
                >
                  <span data-l="TIPO" style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 11 }}>
                    {NOTICE_LABEL[a.kind].toUpperCase()}
                  </span>

                  <div data-l="AVISO" style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 500, fontSize: 13.5 }}>{a.title}</div>
                    {a.body && (
                      <div style={{ fontSize: 12.5, color: "var(--px-mid)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {a.body}
                      </div>
                    )}
                  </div>

                  <span data-l="ALCANCE" style={{ fontSize: 12.5, color: "var(--px-ink2)" }}>
                    {a.scope === "edificio" ? "Todo el edificio" : a.unit_code}
                    <span style={{ color: "var(--px-mid)" }}>
                      {a.source === "porteria" ? " · portería" : ""}
                    </span>
                  </span>

                  <span data-l="CUÁNDO" style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 11, color: "var(--px-ink2)" }}>
                    {fmt(a.starts_at)}
                    {a.ends_at ? ` → ${fmt(a.ends_at)}` : ""}
                  </span>

                  <span data-l="ESTADO">
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

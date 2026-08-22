import type { CSSProperties } from "react";
import { redirect } from "next/navigation";
import { getUserContext } from "@/lib/user-context";
import { getParcels } from "@/lib/encomiendas";
import RegisterEncomiendaButton from "@/components/admin/RegisterEncomiendaButton";

export const revalidate = 0;

function fmt(d: string) {
  return new Date(d).toLocaleString("es-CL", { timeZone: "America/Santiago",
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false,
  });
}

const RETIRO_LABEL: Record<string, string> = {
  codigo: "Código verificado",
  qr: "QR verificado",
  manual: "Sin código",
};

const COL = "150px 100px 1fr 1fr 150px 130px";

export default async function EncomiendaPage() {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");
  if (!ctx.buildingId) redirect("/onboarding");

  const rows = await getParcels(ctx.buildingId);

  const pendientes = rows.filter((r) => r.status === "pendiente");
  // Las que llevan más de una semana ocupando la portería: el conserje
  // necesita ese espacio y alguien tiene que ir a buscarlas.
  const olvidadas = pendientes.filter((r) => r.diasEnPorteria >= 7);
  const sinVerificar = rows.filter((r) => r.pickup_method === "manual").length;

  return (
    <>
      <header className="px-head">
        <div className="px-head-fila">
          <div>
            <div style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 11, color: "var(--px-mid)", letterSpacing: "0.08em" }}>
              ENCOMIENDAS · {pendientes.length} SIN RETIRAR
              {olvidadas.length > 0 ? ` · ${olvidadas.length} HACE MÁS DE UNA SEMANA` : ""}
              {sinVerificar > 0 ? ` · ${sinVerificar} ENTREGADAS SIN CÓDIGO` : ""}
            </div>
            <h1 style={{ margin: "4px 0 0", fontWeight: 600, letterSpacing: "-0.025em" }}>
              Encomiendas
            </h1>
          </div>
          <RegisterEncomiendaButton />
        </div>
      </header>

      <div style={{ flex: 1, overflow: "auto" }}>
        {rows.length === 0 ? (
          <div style={{ padding: 60, textAlign: "center", fontFamily: "var(--font-jetbrains-mono)", fontSize: 12, color: "var(--px-mid)" }}>
            Todavía no se ha registrado ninguna encomienda.
          </div>
        ) : (
          <>
            <div className="px-tabla-head" style={{ "--cols": COL } as CSSProperties}>
              <span>RECIBIDA</span>
              <span>UNIDAD</span>
              <span>QUIÉN LA TRAJO</span>
              <span>QUIÉN LA RETIRÓ</span>
              <span>CÓMO</span>
              <span>ESTADO</span>
            </div>

            {rows.map((p, i) => {
              const dias = p.diasEnPorteria;
              const espera = p.status === "pendiente" && dias >= 7;

              return (
                <div
                  key={p.id}
                  className="px-tabla-fila"
                  style={{
                    "--cols": COL,
                    borderBottom: i < rows.length - 1 ? "1px solid var(--px-line2)" : "none",
                    background: espera ? "oklch(0.98 0.02 28)" : "white",
                  } as CSSProperties}
                >
                  <span data-l="RECIBIDA" style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 11.5 }}>
                    {fmt(p.received_at)}
                  </span>
                  <span data-l="UNIDAD" style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 12, fontWeight: 600 }}>
                    {p.unit_code ?? "—"}
                  </span>
                  <div data-l="QUIÉN LA TRAJO" style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{p.courier ?? "Encomienda"}</div>
                    {p.description && (
                      <div style={{ fontSize: 12, color: "var(--px-mid)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {p.description}
                      </div>
                    )}
                  </div>
                  <span data-l="QUIÉN LA RETIRÓ" style={{ color: p.picked_up_by ? "var(--px-ink)" : "var(--px-mid)" }}>
                    {p.picked_up_by ?? (espera ? `esperando hace ${dias} días` : "—")}
                  </span>
                  <span data-l="CÓMO" style={{
                    fontFamily: "var(--font-jetbrains-mono)", fontSize: 10.5,
                    color: p.pickup_method === "manual" ? "var(--px-alert)" : "var(--px-mid)",
                  }}>
                    {p.pickup_method ? RETIRO_LABEL[p.pickup_method].toUpperCase() : "—"}
                  </span>
                  <span data-l="ESTADO">
                    <span style={{
                      fontFamily: "var(--font-jetbrains-mono)", fontSize: 10, letterSpacing: "0.06em",
                      padding: "3px 7px", borderRadius: 4,
                      color: p.status === "pendiente" ? "oklch(0.48 0.14 75)" : "var(--px-mid)",
                      background: p.status === "pendiente" ? "oklch(0.95 0.06 75)" : "var(--px-line2)",
                    }}>
                      {p.status === "pendiente" ? "EN PORTERÍA" : "RETIRADA"}
                    </span>
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

"use client";

import { useState } from "react";
import { QR_ENCOMIENDA } from "@/lib/qr";
import QrCodigo, { codigoLegible } from "./QrCodigo";

/**
 * Lo que llegó para el departamento.
 *
 * Resuelve las dos preguntas que hoy se hacen bajando a portería: ¿llegó mi
 * paquete? y ¿puede retirarlo otra persona? El código se puede mandar por
 * WhatsApp a quien vaya a buscarlo —la nana, el hijo, un vecino— y en la
 * portería queda escrito quién se lo llevó.
 */

export interface EncomiendaMia {
  id: string;
  courier: string | null;
  description: string | null;
  code: string;
  token: string;
  status: "pendiente" | "retirada";
  receivedAt: string;
  pickedUpAt: string | null;
  pickedUpBy: string | null;
  pickupMethod: "codigo" | "qr" | "manual" | null;
}

const CARD: React.CSSProperties = {
  background: "white",
  border: "1px solid var(--px-line)",
  borderRadius: 18,
  padding: "18px 18px 20px",
};

const MONO: React.CSSProperties = {
  fontFamily: "var(--font-jetbrains-mono)",
  fontSize: 10,
  letterSpacing: "0.08em",
  color: "var(--px-mid)",
};

function cuando(iso: string) {
  const d = new Date(iso);
  const hoy = new Date();
  const ayer = new Date(hoy);
  ayer.setDate(hoy.getDate() - 1);
  const hora = d.toLocaleTimeString("es-CL", { timeZone: "America/Santiago", hour: "2-digit", minute: "2-digit", hour12: false });
  if (d.toDateString() === hoy.toDateString()) return `hoy ${hora}`;
  if (d.toDateString() === ayer.toDateString()) return `ayer ${hora}`;
  return `${d.toLocaleDateString("es-CL", { timeZone: "America/Santiago", day: "numeric", month: "short" })} ${hora}`;
}

export default function MisEncomiendas({
  encomiendas,
  unitCode,
}: {
  encomiendas: EncomiendaMia[];
  unitCode: string;
}) {
  const [abierta, setAbierta] = useState<string | null>(null);

  const pendientes = encomiendas.filter((e) => e.status === "pendiente");
  const retiradas = encomiendas.filter((e) => e.status === "retirada").slice(0, 3);

  if (encomiendas.length === 0) return null;

  return (
    <section style={CARD}>
      <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.02em" }}>
        Lo que llegó para ti
      </div>
      <div style={{ fontSize: 13, color: "var(--px-mid)", marginTop: 2, marginBottom: 14 }}>
        {pendientes.length === 0
          ? "No tienes nada esperando en portería"
          : pendientes.length === 1
          ? "1 encomienda esperando en portería"
          : `${pendientes.length} encomiendas esperando en portería`}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {pendientes.map((e) => {
          const abierto = abierta === e.id;
          const texto =
            `Encomienda de ${e.courier ?? "portería"} para el ${unitCode}.\n` +
            `Muestra este código en conserjería para retirarla: ${codigoLegible(e.code)}.`;

          return (
            <div
              key={e.id}
              style={{
                padding: "13px 14px",
                background: "var(--px-paper)",
                border: "1px solid var(--px-line2)",
                borderRadius: 12,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 500 }}>
                    {e.courier ?? "Encomienda"}
                  </div>
                  <div style={{ ...MONO, marginTop: 2 }}>LLEGÓ {cuando(e.receivedAt).toUpperCase()}</div>
                </div>
                <button
                  onClick={() => setAbierta((actual) => (actual === e.id ? null : e.id))}
                  style={{
                    flexShrink: 0,
                    background: abierto ? "var(--px-ink)" : "transparent",
                    color: abierto ? "var(--px-bone)" : "var(--px-ink)",
                    border: "1px solid var(--px-line)",
                    borderRadius: 8,
                    padding: "8px 12px",
                    font: "inherit",
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: "pointer",
                  }}
                >
                  {abierto ? "Ocultar" : "Retirar"}
                </button>
              </div>

              {abierto && (
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--px-line2)" }}>
                  <QrCodigo
                    contenido={QR_ENCOMIENDA + e.token}
                    code={e.code}
                    textoCompartir={texto}
                    etiquetaBoton="Mandárselo a quien la retira"
                    alt={`Código QR para retirar la encomienda de ${e.courier ?? "portería"}`}
                    pie="Muéstralo en conserjería. También puede retirarla otra persona: mándale el código y queda registrado a su nombre."
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {retiradas.length > 0 && (
        <div style={{ marginTop: pendientes.length ? 16 : 0 }}>
          <div style={{ ...MONO, marginBottom: 8 }}>YA RETIRADAS</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {retiradas.map((e) => (
              <div key={e.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13.5, color: "var(--px-ink2)" }}>
                <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {e.courier ?? "Encomienda"}
                  {e.pickedUpBy ? ` · la retiró ${e.pickedUpBy}` : ""}
                </span>
                <span style={{ ...MONO, flexShrink: 0 }}>
                  {e.pickedUpAt ? cuando(e.pickedUpAt).toUpperCase() : ""}
                  {e.pickupMethod === "manual" ? " · SIN CÓDIGO" : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

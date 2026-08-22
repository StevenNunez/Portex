"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Drawer, { BTN_PRIMARY } from "./Drawer";
import { inviteResidentsBulk } from "@/app/citofono-actions";
import { invitables, invitadosSinEntrar, nuncaInvitados, sinCorreo } from "@/lib/residentes";
import type { ResidentRow } from "@/lib/db";

/**
 * Dar acceso a todo el edificio de una vez.
 *
 * Invitar de a uno funciona para un departamento nuevo, pero un condominio
 * que recién parte tiene 300 y nadie va a apretar 300 veces. Esto manda la
 * invitación a todos los que tengan correo anotado y no tengan cuenta
 * todavía.
 *
 * Los correos salen del padrón: de una invitación anterior o del campo de
 * contacto cuando es un correo. A los que no tienen, no hay nada que
 * mandarles — pero se muestran igual, porque saber cuántos faltan es la
 * mitad del trabajo del administrador.
 */

const MONO = "var(--font-jetbrains-mono)";

interface Resultado {
  enviadas: number;
  yaTenian: number;
  fallidas: { unidad: string; email: string; error: string }[];
  corte?: string;
}

export default function InvitarResidentesButton({ rows }: { rows: ResidentRow[] }) {
  const router = useRouter();

  const [abierto, setAbierto]   = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);

  const listos = invitables(rows);
  const nuevos = nuncaInvitados(rows);
  const reenvios = invitadosSinEntrar(rows);
  const faltantes = sinCorreo(rows);
  const conCuenta = rows.filter((r) => r.tieneCuenta).length;

  // Si el edificio entero ya tiene acceso, el botón no tiene nada que hacer.
  if (listos.length === 0 && faltantes.length === 0) return null;

  function cerrar() {
    setAbierto(false);
    setError(null);
    setResultado(null);
  }

  async function enviar() {
    if (cargando || listos.length === 0) return;
    setCargando(true);
    setError(null);

    const res = await inviteResidentsBulk({
      residentes: listos.map((r) => ({ id: r.id, email: r.email })),
    });

    if (!res.ok) {
      setError(res.error ?? "No se pudieron enviar las invitaciones");
      setCargando(false);
      return;
    }

    setResultado({
      enviadas: res.enviadas,
      yaTenian: res.yaTenian,
      fallidas: res.fallidas,
      corte: res.corte,
    });
    setCargando(false);
    router.refresh();
  }

  return (
    <>
      <button
        onClick={() => setAbierto(true)}
        style={{
          background: "white", color: "var(--px-ink2)",
          border: "1px solid var(--px-line)",
          borderRadius: 8, padding: "9px 14px", fontSize: 13, fontWeight: 500,
          fontFamily: "var(--font-inter-tight), Inter, system-ui, sans-serif",
          whiteSpace: "nowrap", flexShrink: 0,
          cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
        }}
      >
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4">
          <rect x="1" y="3" width="12" height="8.5" rx="1.2" />
          <path d="M1.4 3.6L7 7.6l5.6-4" />
        </svg>
        Dar acceso
        {listos.length > 0 && (
          <span style={{ fontFamily: MONO, fontSize: 11, color: "var(--px-mid)" }}>
            {listos.length}
          </span>
        )}
      </button>

      <Drawer
        open={abierto}
        onClose={cerrar}
        title="Dar acceso a los residentes"
        subtitle={`${conCuenta} DE ${rows.length} YA TIENEN CUENTA`}
      >
        {resultado ? (
          <>
            <div style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 18 }}>
              {resultado.enviadas > 0 && (
                <div>
                  <strong>{resultado.enviadas}</strong>{" "}
                  {resultado.enviadas === 1 ? "invitación enviada" : "invitaciones enviadas"}.
                </div>
              )}
              {resultado.yaTenian > 0 && (
                <div style={{ color: "var(--px-mid)", marginTop: 4 }}>
                  {resultado.yaTenian} ya tenían cuenta en Portex: quedaron ligados a su
                  departamento sin recibir correo.
                </div>
              )}
            </div>

            {resultado.corte && (
              <div
                style={{
                  background: "oklch(0.97 0.05 80)", border: "1px solid oklch(0.85 0.11 80)",
                  borderRadius: 8, padding: "11px 14px", marginBottom: 18,
                  fontSize: 13, color: "oklch(0.42 0.13 70)", lineHeight: 1.55,
                }}
              >
                {resultado.corte}
              </div>
            )}

            {resultado.fallidas.length > 0 && (
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.08em", color: "var(--px-alert)", marginBottom: 8 }}>
                  {resultado.fallidas.length} NO SE PUDIERON ENVIAR
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 220, overflow: "auto" }}>
                  {resultado.fallidas.map((f, i) => (
                    <div
                      key={i}
                      style={{
                        fontSize: 12.5, padding: "8px 10px", borderRadius: 7,
                        background: "oklch(0.97 0.03 28)", border: "1px solid oklch(0.9 0.08 28)",
                      }}
                    >
                      <div style={{ fontFamily: MONO, fontSize: 11, fontWeight: 600 }}>{f.unidad}</div>
                      <div style={{ color: "var(--px-mid)", wordBreak: "break-all" }}>{f.email}</div>
                      <div style={{ color: "oklch(0.45 0.16 28)", marginTop: 2 }}>{f.error}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button onClick={cerrar} style={BTN_PRIMARY}>
              Listo
            </button>
          </>
        ) : (
          <>
            <p style={{ margin: "0 0 18px", fontSize: 14, color: "var(--px-mid)", lineHeight: 1.6 }}>
              A cada uno le llega un correo para crear su contraseña. Desde ese momento
              puede autorizar visitas a su departamento desde el teléfono, sin llamar a
              portería.
            </p>

            <div
              style={{
                display: "flex", flexDirection: "column", gap: 10,
                padding: "14px 16px", borderRadius: 10,
                background: "var(--px-paper)", border: "1px solid var(--px-line2)",
                marginBottom: 18,
              }}
            >
              <Linea
                numero={nuevos.length}
                texto={nuevos.length === 1 ? "residente por invitar" : "residentes por invitar"}
                destacado
              />
              {reenvios.length > 0 && (
                <Linea
                  numero={reenvios.length}
                  texto="ya recibieron el correo y no entraron — se les reenvía"
                />
              )}
              <Linea numero={conCuenta} texto="ya tienen cuenta — no se les manda nada" />
              <Linea
                numero={faltantes.length}
                texto="sin correo anotado — no se les puede invitar"
                alerta={faltantes.length > 0}
              />
            </div>

            {faltantes.length > 0 && (
              <details style={{ marginBottom: 18 }}>
                <summary style={{ cursor: "pointer", fontSize: 13, color: "var(--px-ink2)" }}>
                  Ver los {faltantes.length} sin correo
                </summary>
                <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 5, maxHeight: 160, overflow: "auto" }}>
                  {faltantes.map((r) => (
                    <span
                      key={r.id}
                      title={r.name}
                      style={{
                        fontFamily: MONO, fontSize: 11, padding: "3px 7px",
                        borderRadius: 5, background: "var(--px-line2)", color: "var(--px-ink2)",
                      }}
                    >
                      {r.unit_code}
                    </span>
                  ))}
                </div>
                <p style={{ margin: "10px 0 0", fontSize: 12.5, color: "var(--px-mid)", lineHeight: 1.6 }}>
                  Para incluirlos, agrégales el correo en la columna Contacto —o vuelve a
                  importar el padrón con la columna Correo llena— y repite esto.
                </p>
              </details>
            )}

            {error && (
              <div
                style={{
                  background: "oklch(0.96 0.05 28)", border: "1px solid oklch(0.88 0.12 28)",
                  borderRadius: 8, padding: "10px 14px", marginBottom: 16,
                  fontSize: 13, color: "oklch(0.40 0.18 28)",
                }}
              >
                {error}
              </div>
            )}

            <button
              onClick={enviar}
              disabled={cargando || listos.length === 0}
              style={{
                ...BTN_PRIMARY,
                opacity: cargando || listos.length === 0 ? 0.45 : 1,
                cursor: cargando || listos.length === 0 ? "not-allowed" : "pointer",
              }}
            >
              {cargando
                ? `Enviando ${listos.length}…`
                : listos.length === 0
                  ? "Nadie por invitar"
                  : `Enviar ${listos.length} ${listos.length === 1 ? "invitación" : "invitaciones"} →`}
            </button>

            {cargando && (
              <p style={{ margin: "12px 0 0", fontSize: 12.5, color: "var(--px-mid)", lineHeight: 1.6, textAlign: "center" }}>
                Van de a uno, con una pausa entre correo y correo para no chocar con el
                límite del servidor. No cierres esta ventana.
              </p>
            )}
          </>
        )}
      </Drawer>
    </>
  );
}

function Linea({
  numero, texto, destacado, alerta,
}: {
  numero: number;
  texto: string;
  destacado?: boolean;
  alerta?: boolean;
}) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
      <span
        style={{
          fontFamily: MONO, fontSize: destacado ? 19 : 15, fontWeight: 600,
          minWidth: 32, textAlign: "right",
          color: alerta && numero > 0 ? "var(--px-alert)" : destacado ? "var(--px-ink)" : "var(--px-ink2)",
        }}
      >
        {numero}
      </span>
      <span style={{ fontSize: 13, color: "var(--px-mid)", lineHeight: 1.45 }}>{texto}</span>
    </div>
  );
}

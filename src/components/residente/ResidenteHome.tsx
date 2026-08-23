"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import {
  getMyPendingRequests,
  respondAccessRequest,
  createVisitPass,
  revokeVisitPass,
} from "@/app/citofono-actions";
import type { AccessRequestRow, VisitPassRow, LlegadaRow } from "@/lib/citofono";
import { formatRut, formatRutInput, normalizeRut } from "@/lib/rut";
import MiEstacionamiento from "./MiEstacionamiento";
import PaseQR from "./PaseQR";
import MisEncomiendas, { type EncomiendaMia } from "./MisEncomiendas";
import AvisosDelEdificio, { type AvisoVisible } from "./AvisosDelEdificio";
import PerfilDepto, { type PerfilVisible } from "./PerfilDepto";
import TabsResidente, { type Tab } from "./TabsResidente";
import type { MySpot, ResidentVehicle } from "@/lib/parking-types";
import { activarPush, getPushPermission, subscribePushPermission } from "@/lib/push-navegador";
import { sonarTimbre, type Timbre } from "@/lib/timbre";
import { limpiarBadge, marcarBadge } from "@/lib/badge";

/**
 * El portal del residente.
 *
 * Era una sola lista larguísima —avisos, encomiendas, pases, estacionamiento,
 * historial— y para ver si había llegado un paquete había que pasar por
 * encima de todo lo demás. Ahora son cuatro pestañas abajo, en el orden en
 * que la gente las usa:
 *
 *  · Inicio   — lo que está pasando ahora: alguien en portería, un corte de
 *               agua, un paquete esperando.
 *  · Visitas  — lo único que el residente *hace*: anunciar a alguien.
 *  · Mi depto — lo que es de la unidad: estacionamiento y autos.
 *  · Perfil   — la ficha que el administrador necesita al día.
 *
 * Lo urgente vive en Inicio y además se cuenta en el punto rojo de la
 * pestaña: si alguien está esperando abajo, se ve desde cualquier parte.
 */

interface Unit {
  residentId: string;
  unitCode: string;
  name: string;
}

interface Props {
  staffName: string;
  buildingName: string | null;
  units: Unit[];
  initialPending: AccessRequestRow[];
  recent: AccessRequestRow[];
  /** Quién entró y salió por este departamento, de la bitácora del edificio. */
  llegadas?: LlegadaRow[];
  passes: VisitPassRow[];
  /** Lo que llegó a portería para este departamento. */
  encomiendas?: EncomiendaMia[];
  /** Cortes de agua, ascensor en mantención, el maestro que está trabajando. */
  avisos?: AvisoVisible[];
  /** La ficha del departamento: teléfono, quiénes viven, mascotas. */
  perfil?: PerfilVisible | null;
  vapidPublicKey: string;
  parkingSpots: MySpot[];
  vehicles: ResidentVehicle[];
}

const MONO: CSSProperties = {
  fontFamily: "var(--font-jetbrains-mono)",
  fontSize: 10.5,
  letterSpacing: "0.08em",
  color: "var(--px-mid)",
};

const CARD: CSSProperties = {
  background: "white",
  border: "1px solid var(--px-line)",
  borderRadius: 16,
  padding: "18px 20px",
};

const INPUT: CSSProperties = {
  width: "100%",
  padding: "13px 15px",
  fontSize: 16,
  fontFamily: "var(--font-inter-tight), Inter, system-ui, sans-serif",
  border: "1px solid var(--px-line)",
  borderRadius: 12,
  outline: "none",
  background: "white",
  color: "var(--px-ink)",
};

function hora(iso: string) {
  return new Date(iso).toLocaleTimeString("es-CL", {
    timeZone: "America/Santiago",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function fecha(iso: string) {
  return new Date(iso).toLocaleDateString("es-CL", {
    timeZone: "America/Santiago",
    day: "numeric",
    month: "short",
  });
}

/** Cómo se lee cada movimiento de la bitácora desde el departamento. */
const MOVIMIENTO: Record<string, { verbo: string; color: string }> = {
  in:       { verbo: "entró",             color: "var(--px-ok)" },
  out:      { verbo: "salió",             color: "var(--px-alert)" },
  delivery: { verbo: "dejó un pedido",    color: "var(--px-ink2)" },
  parcel:   { verbo: "dejó una encomienda", color: "var(--px-ink2)" },
  provider: { verbo: "entró a trabajar",  color: "var(--px-ink2)" },
  vehicle:  { verbo: "entró en auto",     color: "var(--px-ink2)" },
};

const ESTADO_LABEL: Record<string, { label: string; color: string }> = {
  aprobada:      { label: "Autorizada",     color: "var(--px-ok)" },
  rechazada:     { label: "Rechazada",      color: "var(--px-alert)" },
  vencida:       { label: "Sin respuesta",  color: "var(--px-mid)" },
  sin_respuesta: { label: "Sin respuesta",  color: "var(--px-mid)" },
};

export default function ResidenteHome({
  staffName,
  buildingName,
  units,
  initialPending,
  recent,
  llegadas = [],
  passes: initialPasses,
  encomiendas = [],
  avisos = [],
  perfil = null,
  vapidPublicKey,
  parkingSpots,
  vehicles,
}: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("inicio");
  const [pending, setPending] = useState(initialPending);
  const [responding, setResponding] = useState<string | null>(null);

  // El permiso de notificaciones no es estado de la app: vive en el navegador
  // y el residente lo puede cambiar desde la configuración de Chrome sin pasar
  // por acá. Se lee suscribiéndose, así la pantalla se entera igual.
  const permisoPush = useSyncExternalStore(
    subscribePushPermission,
    getPushPermission,
    () => "desconocido" as const
  );
  const [activando, setActivando] = useState(false);
  const [suscrito, setSuscrito]   = useState(false);

  const pushState = activando
    ? "activando"
    : suscrito || permisoPush === "granted"
      ? "activo"
      : permisoPush === "denied"
        ? "bloqueado"
        : permisoPush === "no-soportado"
          ? "no-soportado"
          : "desconocido";

  // Nueva visita anticipada
  const [showPassForm, setShowPassForm] = useState(false);
  const [passName, setPassName] = useState("");
  const [passRut, setPassRut] = useState("");
  const [passNote, setPassNote] = useState("");
  const [savingPass, setSavingPass] = useState(false);
  const [passError, setPassError] = useState<string | null>(null);
  const [passes, setPasses] = useState(initialPasses);
  // Qué pase está mostrando su QR. Uno a la vez: el teléfono es chico y lo
  // que importa es el que la visita está por usar.
  const [qrAbierto, setQrAbierto] = useState<string | null>(null);

  const unit = units[0];

  // Nombre y documento: con menos que eso el conserje no puede
  // confirmar que quien llegó es quien tú anunciaste.
  const puedeGuardarPase = passName.trim().length >= 2 && normalizeRut(passRut).length >= 7;

  const encomiendasPendientes = encomiendas.filter((e) => e.status === "pendiente").length;
  const enInicio = pending.length + encomiendasPendientes;

  // ── Consulta periódica: el push despierta el teléfono, esto mantiene
  //    la pantalla al día mientras está abierta.
  const refresh = useCallback(async () => {
    try {
      const rows = await getMyPendingRequests();
      setPending(rows);
    } catch {
      /* sin conexión: se reintenta en el próximo ciclo */
    }
  }, []);

  useEffect(() => {
    const id = setInterval(refresh, 5000);
    const onVisible = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  // Si tocan el timbre estando en otra pestaña, la pantalla salta a Inicio:
  // es lo único que no puede esperar a que el residente navegue solo.
  const pendientesPrevios = useRef(initialPending.length);
  useEffect(() => {
    if (pending.length > pendientesPrevios.current) setTab("inicio");
    pendientesPrevios.current = pending.length;
  }, [pending.length]);

  // ── El punto rojo del ícono ────────────────────────────────────────
  // Sigue exactamente al mismo número que el punto de la pestaña Inicio: lo
  // que está esperando respuesta. Se limpia solo al resolverse, así que si la
  // notificación se deslizó sin querer, el ícono lo sigue diciendo.
  useEffect(() => {
    if (enInicio > 0) marcarBadge(enInicio);
    else limpiarBadge();
  }, [enInicio]);

  // ── El timbre ──────────────────────────────────────────────────────
  // La notificación del sistema suena una vez y se calla; un citófono
  // insiste hasta que alguien contesta. Mientras haya alguien esperando
  // abajo y la app esté abierta, suena. Se calla solo al responder, al
  // vencerse la solicitud o si el residente lo silencia.
  const hayPendientes = pending.length > 0;
  const [silenciado, setSilenciado] = useState(false);
  const timbreRef = useRef<Timbre | null>(null);
  const debeSonar = hayPendientes && !silenciado;

  useEffect(() => {
    if (!debeSonar) {
      timbreRef.current?.detener();
      timbreRef.current = null;
      return;
    }
    if (!timbreRef.current) timbreRef.current = sonarTimbre();

    return () => {
      timbreRef.current?.detener();
      timbreRef.current = null;
    };
  }, [debeSonar]);

  // Silenciar es por visita, no para siempre: cuando ya no queda nadie
  // esperando, el timbre vuelve a estar armado para la próxima. Se ajusta
  // durante el render con estado —no con un ref— porque un ref no se puede
  // leer ni escribir mientras se pinta.
  const [huboPendientes, setHuboPendientes] = useState(hayPendientes);
  if (huboPendientes !== hayPendientes) {
    setHuboPendientes(hayPendientes);
    if (!hayPendientes && silenciado) setSilenciado(false);
  }

  async function activarNotificaciones() {
    if (!vapidPublicKey) return;
    setActivando(true);
    const ok = await activarPush(vapidPublicKey);
    if (ok) setSuscrito(true);
    setActivando(false);
  }

  async function responder(id: string, decision: "aprobada" | "rechazada") {
    setResponding(id);
    const res = await respondAccessRequest(id, decision);
    if (res.ok) {
      setPending((prev) => prev.filter((p) => p.id !== id));
      router.refresh();
    }
    setResponding(null);
  }

  async function guardarPase(e: React.FormEvent) {
    e.preventDefault();
    if (!puedeGuardarPase || savingPass) return;
    setSavingPass(true);
    setPassError(null);

    const res = await createVisitPass({
      residentId: unit.residentId,
      visitorName: passName,
      visitorRut: passRut || undefined,
      note: passNote || undefined,
    });
    setSavingPass(false);

    if (!res.ok || !res.pass) {
      setPassError(res.error ?? "No se pudo guardar el pase. Intenta de nuevo.");
      return;
    }

    // La lista se actualiza acá mismo: el residente tiene que ver el pase
    // apenas lo crea, sin recargar. Y se le abre el QR solo, que es lo que
    // venía a buscar: el paso siguiente es mandárselo a la visita.
    setPasses((prev) => [res.pass!, ...prev]);
    setQrAbierto(res.pass.id);
    setPassName("");
    setPassRut("");
    setPassNote("");
    setShowPassForm(false);
  }

  async function anularPase(id: string) {
    const previo = passes;
    setPasses((prev) => prev.filter((p) => p.id !== id));
    const res = await revokeVisitPass(id);
    if (!res.ok) {
      setPasses(previo);
      setPassError(res.error ?? "No se pudo anular el pase");
    }
  }

  async function salir() {
    const supabase = createSupabaseBrowser();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "var(--px-bone)",
        color: "var(--px-ink)",
        fontFamily: "var(--font-inter-tight), Inter, system-ui, sans-serif",
        letterSpacing: "-0.005em",
        // Espacio para que la barra de pestañas no tape el final del contenido.
        paddingBottom: "calc(80px + env(safe-area-inset-bottom, 0px))",
      }}
    >
      {/* Encabezado */}
      <header
        style={{
          padding: "18px 20px 14px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid var(--px-line)",
        }}
      >
        <div>
          <div style={{ fontWeight: 700, fontSize: 19, letterSpacing: "-0.04em" }}>Portex</div>
          <div style={{ ...MONO, marginTop: 2 }}>
            {(buildingName ?? "MI EDIFICIO").toUpperCase()} · {unit.unitCode}
          </div>
        </div>
        <button
          onClick={salir}
          style={{
            background: "transparent",
            border: "1px solid var(--px-line)",
            borderRadius: 999,
            padding: "7px 13px",
            ...MONO,
            cursor: "pointer",
          }}
        >
          SALIR
        </button>
      </header>

      <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 16, maxWidth: 560, margin: "0 auto" }}>

        {/* ══ INICIO ═══════════════════════════════════════════════ */}
        {tab === "inicio" && (
          <>
            {/* Alguien esperando abajo */}
            {pending.length > 0 && (
              <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {pending.map((req) => (
                  <SolicitudViva
                    key={req.id}
                    req={req}
                    busy={responding === req.id}
                    onResponder={responder}
                  />
                ))}

                {/* Callar el timbre tiene que estar a mano: si la única salida
                    fuera silenciar el teléfono entero, el residente lo dejaría
                    mudo y se perdería todas las visitas siguientes. Vuelve a
                    quedar armado en cuanto se resuelve esta. */}
                {!silenciado && (
                  <button
                    onClick={() => setSilenciado(true)}
                    style={{
                      alignSelf: "center", background: "none", border: "none",
                      color: "var(--px-mid)", font: "inherit", fontSize: 13,
                      padding: "6px 12px", cursor: "pointer",
                      display: "flex", alignItems: "center", gap: 6,
                    }}
                  >
                    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                      <path d="M9 3.5 5.5 6.5H3v3h2.5L9 12.5z" />
                      <path d="M12.5 5.5 15 10M15 5.5l-2.5 4.5" />
                    </svg>
                    Silenciar el timbre
                  </button>
                )}
              </section>
            )}

            {/* Notificaciones */}
            {pushState !== "activo" && pushState !== "no-soportado" && (
              <div style={{ ...CARD, background: "var(--px-ink)", color: "var(--px-bone)", border: "none" }}>
                <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-0.02em", marginBottom: 6 }}>
                  Activa los avisos
                </div>
                <p style={{ fontSize: 13.5, margin: "0 0 14px", color: "oklch(0.88 0.01 60)", lineHeight: 1.5 }}>
                  {pushState === "bloqueado"
                    ? "Tienes las notificaciones bloqueadas en este navegador. Habilítalas en los ajustes del sitio para enterarte cuando alguien llegue a buscarte."
                    : "Sin esto solo te enteras si tienes la página abierta. Con esto suena el teléfono cuando alguien llega a buscarte."}
                </p>
                {pushState !== "bloqueado" && (
                  <button
                    onClick={activarNotificaciones}
                    disabled={pushState === "activando"}
                    style={{
                      width: "100%",
                      padding: "13px",
                      background: "var(--px-bone)",
                      color: "var(--px-ink)",
                      border: "none",
                      borderRadius: 12,
                      font: "inherit",
                      fontSize: 15,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {pushState === "activando" ? "Activando…" : "Activar notificaciones"}
                  </button>
                )}
              </div>
            )}

            {/* Ya activadas, queda lo que Portex no puede hacer por su cuenta:
                el volumen de la alerta lo decide el teléfono, no la app. Si
                esto no se dice, el residente activa los avisos, no los escucha
                y concluye que la app no sirve. */}
            {pushState === "activo" && (
              <details style={{ ...CARD, padding: "14px 18px" }}>
                <summary style={{ cursor: "pointer", fontSize: 14, fontWeight: 500, letterSpacing: "-0.01em" }}>
                  ¿No lo escuchas cuando llega alguien?
                </summary>
                <div style={{ fontSize: 13.5, color: "var(--px-mid)", lineHeight: 1.65, marginTop: 12 }}>
                  <p style={{ margin: "0 0 10px" }}>
                    El volumen de un aviso lo manda el teléfono, no Portex. Dos cosas lo
                    arreglan y se hacen una sola vez:
                  </p>
                  <ol style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 8 }}>
                    <li>
                      <strong style={{ color: "var(--px-ink2)", fontWeight: 600 }}>Instala Portex</strong> en
                      la pantalla de inicio. Desde el navegador los avisos llegan más débiles y
                      el ícono no puede mostrarte el punto rojo.
                    </li>
                    <li>
                      En los ajustes del teléfono, pon las notificaciones de Portex como{" "}
                      <strong style={{ color: "var(--px-ink2)", fontWeight: 600 }}>urgentes</strong> o de
                      máxima prioridad, y déjalas pasar el modo No molestar. Así suenan aunque
                      el teléfono esté en silencio.
                    </li>
                  </ol>
                  <p style={{ margin: "12px 0 0" }}>
                    Con la app abierta, además, Portex toca un timbre que insiste hasta que
                    respondes — como un citófono.
                  </p>
                </div>
              </details>
            )}

            <AvisosDelEdificio avisos={avisos} />

            <MisEncomiendas encomiendas={encomiendas} unitCode={unit.unitCode} />

            {/* Cuando no pasa nada, que se note que no pasa nada. Antes esta
                pantalla mostraba secciones vacías una tras otra. */}
            {pending.length === 0 && avisos.length === 0 && encomiendas.length === 0 && (
              <section style={{ ...CARD, textAlign: "center", padding: "36px 20px" }}>
                <div style={{ fontSize: 30, marginBottom: 10 }}>🌿</div>
                <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-0.02em" }}>
                  Todo tranquilo
                </div>
                <div style={{ fontSize: 13.5, color: "var(--px-mid)", marginTop: 4, lineHeight: 1.5 }}>
                  No hay nadie esperando ni paquetes sin retirar. Cuando alguien llegue a
                  buscarte, aparece acá.
                </div>
              </section>
            )}

            <button
              onClick={() => setTab("visitas")}
              style={{
                ...CARD,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                cursor: "pointer",
                textAlign: "left",
                font: "inherit",
                color: "var(--px-ink)",
              }}
            >
              <div>
                <div style={{ fontSize: 15.5, fontWeight: 600, letterSpacing: "-0.02em" }}>
                  ¿Esperas a alguien?
                </div>
                <div style={{ fontSize: 13, color: "var(--px-mid)", marginTop: 2 }}>
                  Deja el pase listo y la conserjería no te interrumpe
                </div>
              </div>
              <span style={{ fontSize: 20, color: "var(--px-mid)" }}>›</span>
            </button>
          </>
        )}

        {/* ══ VISITAS ══════════════════════════════════════════════ */}
        {tab === "visitas" && (
          <>
            <section style={CARD}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: showPassForm || passes.length ? 14 : 0 }}>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.02em" }}>Avisar una visita</div>
                  <div style={{ fontSize: 13, color: "var(--px-mid)", marginTop: 2 }}>
                    Deja el pase listo y la conserjería no te interrumpe
                  </div>
                </div>
                <button
                  onClick={() => setShowPassForm((v) => !v)}
                  style={{
                    flexShrink: 0,
                    width: 38,
                    height: 38,
                    borderRadius: 19,
                    background: showPassForm ? "var(--px-paper)" : "var(--px-ink)",
                    color: showPassForm ? "var(--px-ink)" : "var(--px-bone)",
                    border: showPassForm ? "1px solid var(--px-line)" : "none",
                    fontSize: 20,
                    cursor: "pointer",
                    lineHeight: 1,
                  }}
                  aria-label={showPassForm ? "Cerrar" : "Nueva visita"}
                >
                  {showPassForm ? "×" : "+"}
                </button>
              </div>

              {showPassForm && (
                <form onSubmit={guardarPase} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <input
                    value={passName}
                    onChange={(e) => setPassName(e.target.value)}
                    placeholder="¿Quién viene? Ej: Juan Pérez"
                    style={INPUT}
                    autoFocus
                  />
                  {/* El RUT no es un dato más: es con lo que el conserje lo
                      identifica cuando llega. Sin eso, el pase no sirve. */}
                  <input
                    value={passRut}
                    onChange={(e) => setPassRut(formatRutInput(e.target.value))}
                    placeholder="RUT de tu visita"
                    inputMode="numeric"
                    maxLength={12}
                    style={{ ...INPUT, fontFamily: "var(--font-jetbrains-mono)", letterSpacing: "0.03em" }}
                  />
                  <input
                    value={passNote}
                    onChange={(e) => setPassNote(e.target.value)}
                    placeholder="Nota para el conserje (opcional)"
                    style={INPUT}
                  />
                  <button
                    type="submit"
                    disabled={!puedeGuardarPase || savingPass}
                    style={{
                      padding: "14px",
                      background: puedeGuardarPase ? "var(--px-ink)" : "var(--px-line)",
                      color: "var(--px-bone)",
                      border: "none",
                      borderRadius: 12,
                      font: "inherit",
                      fontSize: 15.5,
                      fontWeight: 600,
                      cursor: puedeGuardarPase ? "pointer" : "not-allowed",
                    }}
                  >
                    {savingPass ? "Guardando…" : "Dejar el pase listo para hoy"}
                  </button>
                  {passError && (
                    <div style={{ fontSize: 13.5, color: "var(--px-alert)", textAlign: "center" }}>
                      {passError}
                    </div>
                  )}
                  <div style={{ ...MONO, textAlign: "center" }}>VÁLIDO HASTA LAS 23:59 DE HOY</div>
                </form>
              )}

              {passes.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: showPassForm ? 14 : 0 }}>
                  {passes.map((p) => (
                    <div
                      key={p.id}
                      style={{
                        padding: "11px 13px",
                        background: "var(--px-paper)",
                        border: "1px solid var(--px-line2)",
                        borderRadius: 12,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 15, fontWeight: 500 }}>{p.visitor_name}</div>
                          <div style={{ ...MONO, marginTop: 2 }}>
                            HASTA {hora(p.valid_until)}
                            {p.visitor_rut ? ` · ${formatRut(p.visitor_rut)}` : ""}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                          {/* Los pases creados antes del QR siguen sirviendo por
                              RUT: por eso el botón aparece solo si hay token. */}
                          {p.token && p.code && (
                            <button
                              onClick={() => setQrAbierto((actual) => (actual === p.id ? null : p.id))}
                              style={{
                                background: qrAbierto === p.id ? "var(--px-ink)" : "transparent",
                                color: qrAbierto === p.id ? "var(--px-bone)" : "var(--px-ink)",
                                border: "1px solid var(--px-line)",
                                borderRadius: 8,
                                padding: "7px 11px",
                                font: "inherit",
                                fontSize: 13,
                                cursor: "pointer",
                              }}
                            >
                              {qrAbierto === p.id ? "Ocultar" : "Ver QR"}
                            </button>
                          )}
                          <button
                            onClick={() => anularPase(p.id)}
                            style={{
                              background: "transparent",
                              border: "1px solid var(--px-line)",
                              borderRadius: 8,
                              padding: "7px 11px",
                              font: "inherit",
                              fontSize: 13,
                              color: "var(--px-alert)",
                              cursor: "pointer",
                            }}
                          >
                            Anular
                          </button>
                        </div>
                      </div>

                      {qrAbierto === p.id && p.token && p.code && (
                        <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--px-line2)" }}>
                          <PaseQR
                            token={p.token}
                            code={p.code}
                            visitorName={p.visitor_name}
                            unitCode={unit.unitCode}
                            validUntil={p.valid_until}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Entradas y salidas: lo que de verdad pasó en la puerta.
                Antes el residente solo veía lo que él mismo había respondido
                por el citófono; una visita que entró con un pase creado ayer
                no aparecía en ninguna parte. */}
            {llegadas.length > 0 && (
              <section style={CARD}>
                <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.02em", marginBottom: 4 }}>
                  Entradas y salidas
                </div>
                <div style={{ fontSize: 13, color: "var(--px-mid)", marginBottom: 14 }}>
                  Quién pasó por portería preguntando por tu departamento
                </div>

                <div style={{ display: "flex", flexDirection: "column" }}>
                  {llegadas.map((l, i) => {
                    const mov = MOVIMIENTO[l.type] ?? { verbo: "pasó", color: "var(--px-mid)" };
                    return (
                      <div
                        key={l.id}
                        style={{
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                          gap: 12, padding: "11px 0",
                          borderTop: i === 0 ? "none" : "1px solid var(--px-line2)",
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 15, fontWeight: 500 }}>{l.who}</div>
                          <div style={{ ...MONO, marginTop: 2 }}>
                            {fecha(l.recordedAt)} · {hora(l.recordedAt)}
                            {l.context ? ` · ${l.context}` : ""}
                          </div>
                          {/* Con qué permiso entró: el pase que dejaste listo,
                              el citófono, o la portería. */}
                          {l.authorizedBy && (
                            <div style={{ fontSize: 12, color: "var(--px-mid2)", marginTop: 2 }}>
                              {l.authorizedBy}
                            </div>
                          )}
                        </div>
                        <span style={{ ...MONO, color: mov.color, flexShrink: 0 }}>
                          {mov.verbo.toUpperCase()}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Historial */}
            <section style={CARD}>
              <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.02em", marginBottom: 4 }}>
                Solicitudes del citófono
              </div>
              <div style={{ fontSize: 13, color: "var(--px-mid)", marginBottom: 14 }}>
                {recent.length === 0 ? "Todavía sin movimientos" : "Las que respondiste desde acá"}
              </div>

              <div style={{ display: "flex", flexDirection: "column" }}>
                {recent.map((r, i) => {
                  const estado = ESTADO_LABEL[r.status] ?? { label: r.status, color: "var(--px-mid)" };
                  return (
                    <div
                      key={r.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                        padding: "11px 0",
                        borderTop: i === 0 ? "none" : "1px solid var(--px-line2)",
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 500 }}>{r.visitor_name}</div>
                        <div style={{ ...MONO, marginTop: 2 }}>
                          {fecha(r.created_at)} · {hora(r.created_at)}
                          {r.responded_by_name ? ` · ${r.responded_by_name.toUpperCase()}` : ""}
                        </div>
                      </div>
                      <span style={{ ...MONO, color: estado.color, flexShrink: 0 }}>
                        {estado.label.toUpperCase()}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        )}

        {/* ══ MI DEPTO ═════════════════════════════════════════════ */}
        {tab === "depto" && (
          <MiEstacionamiento
            spots={parkingSpots}
            vehicles={vehicles}
            residentId={unit.residentId}
          />
        )}

        {/* ══ PERFIL ═══════════════════════════════════════════════ */}
        {tab === "perfil" && (
          <>
            {perfil ? (
              <PerfilDepto perfil={perfil} />
            ) : (
              <section style={CARD}>
                <div style={{ fontSize: 15, color: "var(--px-mid)" }}>
                  No pudimos cargar la ficha de tu departamento. Recarga la página.
                </div>
              </section>
            )}

            <div style={{ ...MONO, textAlign: "center", paddingTop: 4 }}>
              {staffName.toUpperCase()} · {units.map((u) => u.unitCode).join(" · ")}
            </div>
          </>
        )}
      </div>

      <TabsResidente activa={tab} onCambiar={setTab} pendientes={enInicio} />
    </div>
  );
}

// ── Tarjeta de solicitud en vivo ────────────────────────────────────

function SolicitudViva({
  req,
  busy,
  onResponder,
}: {
  req: AccessRequestRow;
  busy: boolean;
  onResponder: (id: string, decision: "aprobada" | "rechazada") => void;
}) {
  const [restante, setRestante] = useState(() => segundosRestantes(req.expires_at));
  const alarmRef = useRef(false);

  useEffect(() => {
    const id = setInterval(() => setRestante(segundosRestantes(req.expires_at)), 1000);
    return () => clearInterval(id);
  }, [req.expires_at]);

  // Vibrar una vez al aparecer: el teléfono puede estar en la mano
  useEffect(() => {
    if (alarmRef.current) return;
    alarmRef.current = true;
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate([200, 100, 200]);
    }
  }, []);

  return (
    <div
      style={{
        background: "white",
        border: "2px solid var(--px-ink)",
        borderRadius: 18,
        padding: "20px 20px 18px",
        boxShadow: "0 12px 32px -18px rgba(20,15,8,0.5)",
      }}
    >
      <div style={{ ...MONO, color: "var(--px-alert)", marginBottom: 10 }}>
        EN PORTERÍA · {req.unit_code ?? ""} · {restante > 0 ? `${restante}s` : "SIN TIEMPO"}
      </div>

      <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.035em", lineHeight: 1.1 }}>
        {req.visitor_name}
      </div>
      <div style={{ fontSize: 14, color: "var(--px-mid)", marginTop: 6 }}>
        {[req.visitor_rut, req.plate, req.requested_by ? `registró ${req.requested_by}` : null]
          .filter(Boolean)
          .join(" · ") || "Sin más datos"}
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
        <button
          onClick={() => onResponder(req.id, "rechazada")}
          disabled={busy}
          style={{
            flex: 1,
            padding: "15px",
            background: "white",
            color: "var(--px-alert)",
            border: "1px solid var(--px-alert)",
            borderRadius: 13,
            font: "inherit",
            fontSize: 16,
            fontWeight: 600,
            cursor: busy ? "default" : "pointer",
            opacity: busy ? 0.5 : 1,
          }}
        >
          No autorizar
        </button>
        <button
          onClick={() => onResponder(req.id, "aprobada")}
          disabled={busy}
          style={{
            flex: 1.4,
            padding: "15px",
            background: "var(--px-ok)",
            color: "white",
            border: "none",
            borderRadius: 13,
            font: "inherit",
            fontSize: 16,
            fontWeight: 600,
            cursor: busy ? "default" : "pointer",
            opacity: busy ? 0.5 : 1,
          }}
        >
          {busy ? "Enviando…" : "Autorizar"}
        </button>
      </div>
    </div>
  );
}

function segundosRestantes(iso: string) {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 1000));
}


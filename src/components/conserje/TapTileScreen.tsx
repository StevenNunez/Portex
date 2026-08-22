"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { type ActivityItem, type Resident, type FrequentVisitor, type PendingParcel } from "@/lib/mock-data";
import { TILES, type TileId } from "@/lib/config";
import {
  IconMark, IconSearch, IconPlus,
  IconArrowIn, IconArrowOut, IconParcel, IconCar,
} from "@/components/icons";
import LiveClock from "./LiveClock";
import VisitaDrawer from "./VisitaDrawer";
import SalidaDrawer from "./SalidaDrawer";
import SimpleEntryDrawer, { type EntryType } from "./SimpleEntryDrawer";
import EncomiendaDrawer from "./EncomiendaDrawer";
import AsistenciaDrawer, { type PresentStaff } from "./AsistenciaDrawer";
import QrScanDrawer from "./QrScanDrawer";
import SolicitudesDrawer from "./SolicitudesDrawer";
import AvisosPorteria from "./AvisosPorteria";
import MiFichaDrawer from "./MiFichaDrawer";
import { solicitudesEsperando } from "@/app/autoregistro-actions";
import { escucharPush } from "@/lib/push-navegador";
import type { SolicitudPendiente } from "@/lib/autoregistro-tipos";
import { NOTICE_LABEL, type NoticeKind } from "@/lib/avisos-tipos";
import { endShift } from "@/app/actions";
import { registerApprovedRequest } from "@/app/citofono-actions";
import type { MarcaResult } from "@/app/asistencia-actions";
import { createSupabaseBrowser } from "@/lib/supabase-browser";

type ActivityDir = ActivityItem["dir"];

const DIR_META: Record<ActivityDir, { label: string; color: string; Icon: React.FC<{ size?: number }> }> = {
  in:       { label: "INGRESO",    color: "var(--px-ok)",    Icon: IconArrowIn  },
  out:      { label: "SALIDA",     color: "var(--px-alert)", Icon: IconArrowOut },
  parcel:   { label: "ENCOMIENDA", color: "var(--px-ink2)",  Icon: IconParcel   },
  vehicle:  { label: "VEHÍCULO",   color: "var(--px-ink2)",  Icon: IconCar      },
  delivery: { label: "DELIVERY",   color: "var(--px-ink2)",  Icon: IconArrowIn  },
  provider: { label: "PROVEEDOR",  color: "var(--px-ink2)",  Icon: IconArrowIn  },
};

export interface AvisoPorteria {
  id: string;
  kind: NoticeKind;
  title: string;
  unitCode: string | null;
  scope: "edificio" | "unidad";
  endsAt: string | null;
  vigente: boolean;
}

export interface ApprovedAwaiting {
  id: string;
  visitorName: string;
  unitCode: string | null;
  respondedBy: string | null;
  respondedAt: string | null;
}

interface Props {
  initialActivity: ActivityItem[];
  initialTodayActivity: ActivityItem[];
  initialPendingParcels: PendingParcel[];
  residents: Resident[];
  frequentVisitors: FrequentVisitor[];
  staffName?: string;
  buildingName?: string;
  initialApproved?: ApprovedAwaiting[];
  /** Personal con jornada abierta ahora mismo. */
  initialPresentStaff?: PresentStaff[];
  /** Cortes y trabajos del día: el conserje es el primero al que le preguntan. */
  avisos?: AvisoPorteria[];
  /** null cuando el edificio no tiene estacionamientos cargados. */
  parkingSummary?: { free: number; total: number } | null;
  /** Vecinos que escanearon el cartel y esperan que la portería confirme. */
  solicitudes?: SolicitudPendiente[];
  /** Sin esta clave no hay avisos que ofrecer. */
  vapidPublicKey?: string;
  /** Qué acceso va destacado en negro: el que más se usa en este edificio. */
  tilePrincipal?: TileId;
}

export default function TapTileScreen({ initialActivity, initialTodayActivity, initialPendingParcels, residents, frequentVisitors, staffName, buildingName, initialApproved = [], initialPresentStaff = [], avisos = [], parkingSummary, solicitudes = [], vapidPublicKey = "", tilePrincipal = "visita" }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [activity, setActivity]             = useState<ActivityItem[]>(initialActivity);
  const [todayActivity, setTodayActivity]   = useState<ActivityItem[]>(initialTodayActivity);
  const [pendingParcels, setPendingParcels] = useState<PendingParcel[]>(initialPendingParcels);
  const [parcelsFromServer, setParcelsFromServer] = useState(initialPendingParcels);
  if (parcelsFromServer !== initialPendingParcels) {
    setParcelsFromServer(initialPendingParcels);
    setPendingParcels(initialPendingParcels);
  }
  const [showEncomiendas, setShowEncomiendas] = useState(false);
  const [showSolicitudes, setShowSolicitudes] = useState(false);
  const [showMiFicha, setShowMiFicha] = useState(false);

  // La portería es un kiosco que queda abierto todo el turno. Sin esto, una
  // solicitud que entra a las 15:00 no aparece hasta que alguien recargue la
  // página —y nadie recarga una pantalla que está "funcionando"—.
  //
  // El push despierta al conserje cuando no está mirando; esto mantiene la
  // pantalla al día cuando sí lo está. Se pregunta solo por el número, que es
  // una consulta mínima: recién si cambió se pide la página completa.
  const revisarSolicitudes = useCallback(async () => {
    try {
      const cuantas = await solicitudesEsperando();
      if (cuantas !== solicitudes.length) router.refresh();
    } catch {
      /* sin conexión: se reintenta en el próximo ciclo */
    }
  }, [router, solicitudes.length]);

  useEffect(() => {
    const id = setInterval(revisarSolicitudes, 30000);
    const alVolver = () => document.visibilityState === "visible" && revisarSolicitudes();
    document.addEventListener("visibilitychange", alVolver);
    // Y en el acto cuando llega un push, sin esperar al próximo ciclo.
    const dejarDeEscuchar = escucharPush(revisarSolicitudes);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", alVolver);
      dejarDeEscuchar();
    };
  }, [revisarSolicitudes]);
  const [showAsistencia, setShowAsistencia]   = useState(false);

  // El marcaje se pinta al toque en el contador, pero la verdad la tiene el
  // servidor: cuando `router.refresh()` trae la lista nueva, esta se adopta
  // durante el render (el patrón de React para reaccionar a un cambio de prop,
  // sin el parpadeo de hacerlo en un efecto).
  const [presentStaff, setPresentStaff] = useState<PresentStaff[]>(initialPresentStaff);
  const [presentFromServer, setPresentFromServer] = useState(initialPresentStaff);
  if (presentFromServer !== initialPresentStaff) {
    setPresentFromServer(initialPresentStaff);
    setPresentStaff(initialPresentStaff);
  }

  // Visitas que la unidad autorizó y quedaron sin registrar (el conserje
  // cerró el drawer, se cortó la conexión, atendió otra cosa).
  const [approved, setApproved] = useState<ApprovedAwaiting[]>(initialApproved);
  const [registeringId, setRegisteringId] = useState<string | null>(null);

  async function handleRegisterApproved(item: ApprovedAwaiting) {
    if (registeringId) return;
    setRegisteringId(item.id);
    const res = await registerApprovedRequest(item.id);
    if (res.ok) {
      setApproved((prev) => prev.filter((a) => a.id !== item.id));
      router.refresh();
    }
    setRegisteringId(null);
  }

  const [openTile, setOpenTile]     = useState<TileId | null>(null);
  const [simpleType, setSimpleType] = useState<EntryType>("entrega");

  // Fin de turno
  const [showEndShift, setShowEndShift] = useState(false);
  const [endingShift, setEndingShift]   = useState(false);
  const [shiftEnded, setShiftEnded]     = useState(false);

  function handleTileClick(id: TileId) {
    if (id === "entrega" || id === "proveedor") {
      setSimpleType(id === "proveedor" ? "provider" : "entrega");
      setOpenTile(id);
    } else {
      setOpenTile(id);
    }
  }

  function handleRegistered(item: ActivityItem) {
    setActivity((prev) => [item, ...prev]);
    setTodayActivity((prev) => [item, ...prev]);
    // La encomienda queda guardada en el servidor con su código de retiro,
    // así que la lista de pendientes se pide de vuelta en vez de inventarla
    // acá: el id que importa es el del paquete, no el de la bitácora.
    if (item.dir === "parcel") router.refresh();
  }

  function handleParcelDelivered(parcelId: string) {
    setPendingParcels((prev) => prev.filter((p) => p.id !== parcelId));
  }

  // El contador de personal se corrige al toque, sin esperar el refresh:
  // el conserje ve el resultado de lo que la persona acaba de marcar.
  function handleMarcaAsistencia(res: MarcaResult) {
    if (!res.ok || !res.staffName) return;
    if (res.action === "entrada") {
      setPresentStaff((prev) => [
        ...prev,
        { id: res.staffName!, name: res.staffName!, role: res.role ?? "", since: res.at ?? new Date().toISOString() },
      ]);
    } else {
      setPresentStaff((prev) => prev.filter((p) => p.name !== res.staffName));
    }
    router.refresh();
  }

  async function handleEndShift() {
    setEndingShift(true);
    const res = await endShift();
    if (res.ok) {
      setShiftEnded(true);
      // Cerrar la sesión de verdad: la tablet queda en el lobby y el
      // turno siguiente entra con su propia cuenta. Sin esto el push a
      // /login rebota de vuelta a /conserje con la sesión abierta.
      const supabase = createSupabaseBrowser();
      await supabase.auth.signOut();
      setTimeout(() => {
        router.push("/login");
        router.refresh();
      }, 1500);
    }
    setEndingShift(false);
  }

  return (
    <div style={{ minHeight: "100dvh", background: "var(--px-bone)", color: "var(--px-ink)", fontFamily: "var(--font-inter-tight), Inter, system-ui, sans-serif", display: "flex", flexDirection: "column", letterSpacing: "-0.005em" }}>

      {/* ── Top bar ──────────────────────────────────────────────────── */}
      <header className="px-conserje-pad" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, padding: "20px 32px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <IconMark size={20} />
          <span style={{ fontWeight: 600, fontSize: 18, letterSpacing: "-0.02em" }}>Portex</span>
          {buildingName && <span style={{ marginLeft: 18, color: "var(--px-mid)", fontSize: 14 }}>{buildingName}</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Cuántos cupos quedan, sin tener que abrir nada: si llega un auto
              y no hay ninguno, el conserje ya lo sabe. */}
          {parkingSummary && (
            <span
              style={{
                display: "flex", alignItems: "center", gap: 6,
                fontFamily: "var(--font-jetbrains-mono)", fontSize: 12,
                padding: "6px 10px", borderRadius: 999, background: "white",
                border: `1px solid ${parkingSummary.free === 0 ? "var(--px-alert)" : "var(--px-line)"}`,
                color: parkingSummary.free === 0 ? "var(--px-alert)" : "var(--px-ink2)",
              }}
              title="Estacionamientos disponibles para visitas"
            >
              {parkingSummary.free === 0
                ? "SIN EST. VISITA"
                : `${parkingSummary.free}/${parkingSummary.total} EST. VISITA`}
            </span>
          )}
          <LiveClock />
          {/* El chip del turno abre la ficha propia: es el único lugar de la
              portería que ya dice "yo", así que es donde uno lo busca. */}
          <button
            onClick={() => setShowMiFicha(true)}
            title="Mis datos de contacto"
            style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: "var(--font-jetbrains-mono)", fontSize: 12, color: "var(--px-ink2)", padding: "6px 10px", borderRadius: 999, background: "white", border: "1px solid var(--px-line)", cursor: "pointer" }}
          >
            <span style={{ width: 6, height: 6, borderRadius: 3, background: "var(--px-ok)", flexShrink: 0 }} />
            {staffName ? staffName.split(" ")[0].toUpperCase() : "TURNO ACTIVO"}
          </button>
          <AvisosPorteria vapidPublicKey={vapidPublicKey} />
          <button
            onClick={() => setShowEndShift(true)}
            style={{ padding: "6px 12px", background: "transparent", border: "1px solid var(--px-line)", borderRadius: 999, fontFamily: "var(--font-jetbrains-mono)", fontSize: 11, color: "var(--px-mid)", cursor: "pointer", letterSpacing: "0.04em" }}
          >
            FIN TURNO
          </button>
        </div>
      </header>

      {/* ── Lo que está pasando en el edificio ───────────────────────── */}
      {avisos.length > 0 && (
        <div className="px-conserje-pad" style={{ padding: "0 32px 14px", display: "flex", flexWrap: "wrap", gap: 8, flexShrink: 0 }}>
          {avisos.map((a) => (
            <div
              key={a.id}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 14px", borderRadius: 999,
                background: a.vigente ? "oklch(0.96 0.05 75)" : "white",
                border: `1px solid ${a.vigente ? "oklch(0.75 0.14 75)" : "var(--px-line)"}`,
              }}
            >
              <span style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 10, letterSpacing: "0.08em", color: a.vigente ? "oklch(0.48 0.14 75)" : "var(--px-mid)" }}>
                {a.vigente ? "AHORA" : "HOY"}
              </span>
              <span style={{ fontSize: 14, fontWeight: 500 }}>
                {NOTICE_LABEL[a.kind]} · {a.title}
              </span>
              <span style={{ fontSize: 13, color: "var(--px-mid)" }}>
                {a.scope === "unidad" && a.unitCode ? a.unitCode : "todo el edificio"}
                {a.endsAt
                  ? ` · hasta ${new Date(a.endsAt).toLocaleTimeString("es-CL", { timeZone: "America/Santiago", hour: "2-digit", minute: "2-digit", hour12: false })}`
                  : ""}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── Vecinos pidiendo acceso a la app ─────────────────────────── */}
      {solicitudes.length > 0 && (
        <div className="px-conserje-pad" style={{ padding: "0 32px 14px", flexShrink: 0 }}>
          <button
            onClick={() => setShowSolicitudes(true)}
            style={{
              width: "100%", textAlign: "left", font: "inherit", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
              padding: "14px 20px", borderRadius: 14,
              background: "oklch(0.96 0.05 250)", border: "1px solid oklch(0.72 0.11 250)",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 10.5, letterSpacing: "0.08em", color: "oklch(0.42 0.13 250)" }}>
                PIDEN ACCESO A LA APP · FALTA CONFIRMAR QUE VIVEN ACÁ
              </div>
              <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.02em", marginTop: 3 }}>
                {solicitudes.length === 1
                  ? `${solicitudes[0].name} · ${solicitudes[0].unitCode}`
                  : `${solicitudes.length} vecinos esperando`}
              </div>
            </div>
            <span
              style={{
                flexShrink: 0, padding: "13px 22px", background: "oklch(0.45 0.14 250)", color: "white",
                borderRadius: 12, fontSize: 15, fontWeight: 600,
              }}
            >
              Revisar
            </span>
          </button>
        </div>
      )}

      {/* ── Autorizadas esperando registro ───────────────────────────── */}
      {approved.length > 0 && (
        <div className="px-conserje-pad" style={{ padding: "0 32px 14px", display: "flex", flexDirection: "column", gap: 8, flexShrink: 0 }}>
          {approved.map((a) => (
            <div
              key={a.id}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
                padding: "14px 20px", borderRadius: 14,
                background: "oklch(0.95 0.05 150)", border: "1px solid var(--px-ok)",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 10.5, letterSpacing: "0.08em", color: "oklch(0.42 0.12 150)" }}>
                  AUTORIZADA · FALTA REGISTRAR EL INGRESO
                </div>
                <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.02em", marginTop: 3 }}>
                  {a.visitorName}
                  {a.unitCode ? <span style={{ color: "var(--px-mid)", fontWeight: 400 }}> · {a.unitCode}</span> : null}
                </div>
                <div style={{ fontSize: 13, color: "var(--px-ink2)", marginTop: 2 }}>
                  {a.respondedBy ? `${a.respondedBy} lo autorizó` : "La unidad lo autorizó"}
                </div>
              </div>
              <button
                onClick={() => handleRegisterApproved(a)}
                disabled={registeringId === a.id}
                style={{
                  flexShrink: 0, padding: "13px 22px", background: "var(--px-ok)", color: "white",
                  border: "none", borderRadius: 12, font: "inherit", fontSize: 15, fontWeight: 600,
                  cursor: registeringId === a.id ? "default" : "pointer",
                }}
              >
                {registeringId === a.id ? "Registrando…" : "Registrar ingreso"}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Search ───────────────────────────────────────────────────── */}
      <div className="px-conserje-pad" style={{ padding: "4px 32px 18px", flexShrink: 0 }}>
        <label style={{ background: "white", borderRadius: 16, border: "1px solid var(--px-line)", padding: "clamp(12px, 3vw, 16px) clamp(14px, 4vw, 22px)", display: "flex", alignItems: "center", gap: 14, cursor: "text", minWidth: 0 }}>
          <IconSearch size={22} style={{ color: "var(--px-mid)" }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar persona, depto o placa…"
            style={{ flex: 1, minWidth: 0, border: "none", outline: "none", fontSize: 20, color: "var(--px-ink)", background: "transparent", fontFamily: "var(--font-inter-tight), Inter, system-ui, sans-serif", letterSpacing: "-0.005em" }}
          />
          {/* En el teléfono los accesos ya están justo abajo, a la vista: la
              pista sobra y no cabe. */}
          <span className="px-solo-ancho" style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 11, color: "var(--px-mid)", padding: "6px 10px", borderRadius: 6, background: "var(--px-paper)", border: "1px solid var(--px-line2)", whiteSpace: "nowrap", flexShrink: 0 }}>
            O usa los accesos abajo ↓
          </span>
        </label>
      </div>

      {/* ── Tile grid ────────────────────────────────────────────────── */}
      <section className="px-tiles" style={{ flex: 1, padding: "0 32px 14px", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gridTemplateRows: "repeat(2, 1fr)", gap: 14, minHeight: 0 }}>
        {TILES.map((tile) => {
          // Cuál va en negro no está fijo en el código: es el acceso que más
          // usa **este** edificio. La salida se queda en rojo pase lo que
          // pase — el color ahí no es jerarquía, es significado.
          const esPrincipal = tile.id === tilePrincipal && !tile.alert;
          const variante = esPrincipal ? "principal" : tile.alert ? "alerta" : "normal";

          return (
            <button
              key={tile.id}
              className="px-tile"
              data-variante={variante}
              onClick={() => handleTileClick(tile.id)}
              style={{
                position: "relative",
                borderRadius: 18, padding: "clamp(16px, 4vw, 24px) clamp(16px, 4vw, 26px)", minHeight: 132,
                textAlign: "left", cursor: "pointer",
                display: "flex", flexDirection: "column", justifyContent: "space-between",
                font: "inherit",
                gridColumn: tile.id === "salida" ? "1 / 3" : undefined,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 11, letterSpacing: "0.08em", color: "var(--tile-suave)" }}>
                  {tile.kicker ?? (esPrincipal ? "LO QUE MÁS REGISTRAS" : tile.alert ? "SALIDAS" : "INGRESO · TIPO")}
                </span>
              </div>
              <div>
                <div style={{ fontSize: "clamp(22px, 5.5vw, 40px)", fontWeight: 600, letterSpacing: "-0.025em", lineHeight: 1, marginBottom: 6, color: "var(--tile-titulo)" }}>
                  {tile.label}
                </div>
                <div style={{ fontSize: 14, color: "var(--tile-suave)" }}>
                  {tile.hint}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8, fontSize: 12, color: "var(--tile-suave)" }}>
                {/* En dos columnas la frase se parte en dos líneas y el botón
                    queda descuadrado. El círculo con el + dice lo mismo. */}
                <span className="px-solo-ancho" style={{ fontFamily: "var(--font-jetbrains-mono)" }}>Tap para registrar</span>
                <span style={{ width: 32, height: 32, borderRadius: 16, background: "var(--tile-punto)", color: "var(--tile-punto-fg)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <IconPlus size={16} />
                </span>
              </div>
            </button>
          );
        })}
      </section>

      {/* ── Bottom strip ─────────────────────────────────────────────── */}
      <section className="px-conserje-pie" style={{ padding: "8px 32px 20px", flexShrink: 0, display: "grid", gridTemplateColumns: "1fr 300px 250px", gap: 14 }}>
        {/* Recent activity */}
        <div style={{ background: "white", border: "1px solid var(--px-line)", borderRadius: 16, padding: "12px 18px", display: "flex", alignItems: "center", gap: 18, overflow: "hidden" }}>
          <div style={{ flexShrink: 0 }}>
            <div style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 10, letterSpacing: "0.08em", color: "var(--px-mid)" }}>ÚLTIMOS REGISTROS</div>
            <div style={{ fontSize: 13, color: "var(--px-ink2)", marginTop: 2 }}>en vivo</div>
          </div>
          <div style={{ width: 1, height: 32, background: "var(--px-line)", flexShrink: 0 }} />
          <div style={{ flex: 1, display: "flex", gap: 22, overflow: "hidden" }}>
            {activity.slice(0, 4).map((a, i) => {
              const meta   = DIR_META[a.dir] ?? DIR_META.in;
              const DirIcon = meta.Icon;
              return (
                <div key={a.id ?? i} style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                  <span style={{ color: meta.color, display: "flex", flexShrink: 0, width: 24, height: 24, borderRadius: 12, background: "var(--px-paper)", alignItems: "center", justifyContent: "center" }}>
                    <DirIcon size={12} />
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.who}</div>
                    <div style={{ fontSize: 11, fontFamily: "var(--font-jetbrains-mono)", color: "var(--px-mid)" }}>{a.t} · {a.unit}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Pending packages */}
        <div style={{ background: "white", border: `1px solid ${pendingParcels.length > 0 ? "var(--px-alert)" : "var(--px-line)"}`, borderRadius: 16, padding: "12px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 10, letterSpacing: "0.08em", color: pendingParcels.length > 0 ? "var(--px-alert)" : "var(--px-mid)" }}>ENCOMIENDAS PENDIENTES</div>
            <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em", marginTop: 2 }}>
              {pendingParcels.length}{" "}
              <span style={{ fontSize: 13, fontWeight: 400, color: "var(--px-mid)" }}>sin retirar</span>
            </div>
          </div>
          <button
            onClick={() => setShowEncomiendas(true)}
            style={{ background: pendingParcels.length > 0 ? "var(--px-alert)" : "var(--px-ink)", color: "white", border: "none", borderRadius: 10, padding: "10px 16px", fontFamily: "var(--font-inter-tight), Inter, system-ui, sans-serif", fontSize: 13, fontWeight: 600, cursor: "pointer", letterSpacing: "-0.005em", flexShrink: 0 }}
          >
            {pendingParcels.length > 0 ? "Entregar ✓" : "Ver"}
          </button>
        </div>

        {/* Personal en el edificio */}
        <div style={{ background: "white", border: "1px solid var(--px-line)", borderRadius: 16, padding: "12px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 10, letterSpacing: "0.08em", color: "var(--px-mid)" }}>PERSONAL</div>
            <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em", marginTop: 2 }}>
              {presentStaff.length}{" "}
              <span style={{ fontSize: 13, fontWeight: 400, color: "var(--px-mid)" }}>en turno</span>
            </div>
          </div>
          <button
            onClick={() => setShowAsistencia(true)}
            style={{ background: "var(--px-ink)", color: "white", border: "none", borderRadius: 10, padding: "10px 16px", fontFamily: "var(--font-inter-tight), Inter, system-ui, sans-serif", fontSize: 13, fontWeight: 600, cursor: "pointer", letterSpacing: "-0.005em", flexShrink: 0 }}
          >
            Marcar
          </button>
        </div>
      </section>

      {/* ── Drawers ───────────────────────────────────────────────────── */}
      <VisitaDrawer
        open={openTile === "visita"}
        onClose={() => setOpenTile(null)}
        onRegistered={handleRegistered}
        residents={residents}
        frequentVisitors={frequentVisitors}
      />
      <SalidaDrawer
        open={openTile === "salida"}
        onClose={() => setOpenTile(null)}
        onRegistered={handleRegistered}
        recentActivity={todayActivity}
      />
      <SimpleEntryDrawer
        type={simpleType}
        open={openTile === "entrega" || openTile === "proveedor"}
        onClose={() => setOpenTile(null)}
        onRegistered={handleRegistered}
        residents={residents}
      />

      <QrScanDrawer
        open={openTile === "qr"}
        onClose={() => setOpenTile(null)}
        onRegistered={handleRegistered}
      />

      <MiFichaDrawer open={showMiFicha} onClose={() => setShowMiFicha(false)} />

      <SolicitudesDrawer
        open={showSolicitudes}
        onClose={() => setShowSolicitudes(false)}
        solicitudes={solicitudes}
      />

      <AsistenciaDrawer
        open={showAsistencia}
        onClose={() => setShowAsistencia(false)}
        present={presentStaff}
        onMarked={handleMarcaAsistencia}
      />

      <EncomiendaDrawer
        open={showEncomiendas}
        onClose={() => setShowEncomiendas(false)}
        parcels={pendingParcels}
        onDelivered={handleParcelDelivered}
      />

      {/* ── Fin de turno modal ─────────────────────────────────────────── */}
      {showEndShift && (
        <>
          <div style={{ position: "fixed", inset: 0, background: "rgba(20,15,8,0.6)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
            <div style={{ background: "white", borderRadius: 20, padding: "36px 32px", maxWidth: 360, width: "100%", textAlign: "center" }}>
              {shiftEnded ? (
                <>
                  <div style={{ width: 64, height: 64, borderRadius: 32, background: "var(--px-ink)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
                    <svg viewBox="0 0 24 24" width={28} height={28} fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 8 }}>Turno finalizado</div>
                  <div style={{ fontSize: 14, color: "var(--px-mid)" }}>Redirigiendo…</div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 10 }}>¿Finalizar turno?</div>
                  <div style={{ fontSize: 14, color: "var(--px-mid)", lineHeight: 1.5, marginBottom: 28 }}>
                    Se registrará tu salida y el turno quedará marcado como completado.
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button
                      onClick={() => setShowEndShift(false)}
                      disabled={endingShift}
                      style={{ flex: 1, padding: "13px", background: "white", border: "1px solid var(--px-line)", borderRadius: 10, font: "inherit", fontSize: 14, fontWeight: 500, cursor: "pointer", color: "var(--px-ink2)" }}
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleEndShift}
                      disabled={endingShift}
                      style={{ flex: 1, padding: "13px", background: "var(--px-ink)", color: "var(--px-bone)", border: "none", borderRadius: 10, font: "inherit", fontSize: 14, fontWeight: 600, cursor: endingShift ? "default" : "pointer" }}
                    >
                      {endingShift ? "Guardando…" : "Sí, finalizar"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { type ActivityItem, type FrequentVisitor, type Resident } from "@/lib/mock-data";
import { registerEntry } from "@/app/actions";
import {
  checkPassForVisitor,
  createAccessRequest,
  pollAccessRequest,
  cancelAccessRequest,
  consumePass,
  type PassCheck,
} from "@/app/citofono-actions";
import { lookupVisitorByRut, getParkingForUnit, lookupPlate, type RutLookupResult } from "@/app/actions";
import type { ParkingAvailability } from "@/lib/parking-types";
import { formatRutInput, isValidRut, normalizeRut } from "@/lib/rut";
import { useFocusOnOpen, useResetOnOpen, atributosDeCajon } from "@/lib/drawer";
import type { RequestStatus } from "@/lib/database.types";

const MOTIVOS = ["Visita", "Servicio", "Trabajo"] as const;
type Motivo = (typeof MOTIVOS)[number];

function fechaCorta(iso: string) {
  return new Date(iso).toLocaleDateString("es-CL", { timeZone: "America/Santiago", day: "numeric", month: "short" });
}
import { IconSearch } from "@/components/icons";
import { mensajeParaPersona } from "@/lib/errores";
import BotonCerrar from "@/components/BotonCerrar";

function initials(name: string) {
  return name.split(" ").slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

function nowTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function nowTimeOf(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/**
 * Lo que ve el conserje mientras el departamento decide. Tiene que ser
 * legible a un metro de distancia: el visitante está parado al frente.
 */
function EsperaAutorizacion({
  visitorName,
  unit,
  status,
  respondedBy,
  remaining,
  saving,
  onCancel,
  onRegisterAnyway,
  onClose,
}: {
  visitorName: string;
  unit: string;
  status: RequestStatus | null;
  respondedBy: string | null;
  remaining: number;
  saving: boolean;
  onCancel: () => void;
  onRegisterAnyway: () => void;
  onClose: () => void;
}) {
  const esperando = status === "pendiente";
  const rechazada = status === "rechazada";
  const vencida = status === "vencida" || status === "sin_respuesta";

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18, textAlign: "center", padding: "10px 0 4px" }}>
      {esperando && (
        <>
          <div
            style={{
              width: 92, height: 92, borderRadius: 46,
              border: "3px solid var(--px-line)", borderTopColor: "var(--px-ink)",
              animation: "px-spin 1.1s linear infinite",
            }}
          />
          <div>
            <div style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.025em" }}>
              Esperando al {unit}
            </div>
            <div style={{ fontSize: 15, color: "var(--px-mid)", marginTop: 6 }}>
              Le llegó el aviso de que {visitorName} está en portería
            </div>
          </div>
          <div style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 34, fontWeight: 600, letterSpacing: "-0.03em" }}>
            {remaining}s
          </div>
          <button
            onClick={onCancel}
            style={{ background: "transparent", border: "1px solid var(--px-line)", borderRadius: 12, padding: "12px 22px", font: "inherit", fontSize: 14.5, color: "var(--px-mid)", cursor: "pointer" }}
          >
            Cancelar
          </button>
        </>
      )}

      {status === "aprobada" && (
        <>
          <div style={{ width: 72, height: 72, borderRadius: 36, background: "var(--px-ok)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg viewBox="0 0 24 24" width={32} height={32} fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.025em" }}>Autorizado</div>
            <div style={{ fontSize: 15, color: "var(--px-mid)", marginTop: 6 }}>
              {respondedBy ? `${respondedBy} dejó pasar a ${visitorName}` : `${visitorName} puede subir`}
            </div>
          </div>
          <div style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 11, color: "var(--px-mid)" }}>
            {saving ? "REGISTRANDO INGRESO…" : "INGRESO REGISTRADO"}
          </div>
        </>
      )}

      {rechazada && (
        <>
          <div style={{ width: 72, height: 72, borderRadius: 36, background: "var(--px-alert)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 34, lineHeight: 1 }}>
            ×
          </div>
          <div>
            <div style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.025em" }}>No autorizado</div>
            <div style={{ fontSize: 15, color: "var(--px-mid)", marginTop: 6 }}>
              {respondedBy ? `${respondedBy} no autorizó el ingreso` : "El departamento no autorizó el ingreso"}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: "var(--px-ink)", color: "var(--px-bone)", border: "none", borderRadius: 13, padding: "14px 30px", font: "inherit", fontSize: 15.5, fontWeight: 600, cursor: "pointer" }}
          >
            Entendido
          </button>
        </>
      )}

      {vencida && (
        <>
          <div style={{ width: 72, height: 72, borderRadius: 36, background: "var(--px-paper)", border: "1px solid var(--px-line)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--px-mid)", fontSize: 30 }}>
            ?
          </div>
          <div>
            <div style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.025em" }}>Sin respuesta</div>
            <div style={{ fontSize: 15, color: "var(--px-mid)", marginTop: 6, maxWidth: 340 }}>
              El {unit} no contestó. Si lo dejas pasar, queda registrado que entró sin autorización de la unidad.
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, width: "100%", maxWidth: 420 }}>
            <button
              onClick={onClose}
              style={{ flex: 1, background: "white", border: "1px solid var(--px-line)", borderRadius: 13, padding: "14px", font: "inherit", fontSize: 15.5, fontWeight: 500, color: "var(--px-ink2)", cursor: "pointer" }}
            >
              No entra
            </button>
            <button
              onClick={onRegisterAnyway}
              disabled={saving}
              style={{ flex: 1.3, background: "var(--px-ink)", color: "var(--px-bone)", border: "none", borderRadius: 13, padding: "14px", font: "inherit", fontSize: 15.5, fontWeight: 600, cursor: saving ? "default" : "pointer" }}
            >
              {saving ? "Guardando…" : "Registrar igual"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

const LABEL: React.CSSProperties = {
  fontFamily: "var(--font-jetbrains-mono)",
  fontSize: 10, letterSpacing: "0.08em", color: "var(--px-mid)", marginBottom: 8,
};

interface VisitaDrawerProps {
  open: boolean;
  onClose: () => void;
  onRegistered: (item: ActivityItem) => void;
  residents: Resident[];
  frequentVisitors: FrequentVisitor[];
}

export default function VisitaDrawer({ open, onClose, onRegistered, residents, frequentVisitors }: VisitaDrawerProps) {
  const [name, setName]               = useState("");
  const [rut, setRut]                 = useState("");
  const [unitQuery, setUnitQuery]     = useState("");
  const [unitElegida, setSelectedUnit] = useState<Resident | null>(null);
  const [plate, setPlate]             = useState("");
  const [saving, setSaving]           = useState(false);
  const [success, setSuccess]         = useState(false);
  // Quién quedó registrado según el servidor: es el nombre real del
  // conserje de turno, no una constante.
  const [savedBy, setSavedBy]         = useState("");
  const [authorizedBy, setAuthorizedBy] = useState("");
  const savingRef = useRef(false);
  const nameRef   = useRef<HTMLInputElement>(null);

  // ── Citófono: pase previo y espera de autorización ──────────────
  const [passEncontrado, setPassCheck] = useState<PassCheck | null>(null);
  const [waiting, setWaiting]       = useState(false);
  const [requestId, setRequestId]   = useState<string | null>(null);
  const [expiresAt, setExpiresAt]   = useState<string | null>(null);
  const [waitStatus, setWaitStatus] = useState<RequestStatus | null>(null);
  const [respondedBy, setRespondedBy] = useState<string | null>(null);
  const [waitError, setWaitError]   = useState<string | null>(null);
  // Si el guardado falla, el conserje tiene que saberlo: antes quedaba solo en
  // la consola y la visita pasaba sin quedar en la bitácora.
  const [saveError, setSaveError]   = useState<string | null>(null);
  const [remaining, setRemaining]   = useState(0);

  // ── Estacionamiento ─────────────────────────────────────────────
  // Se consulta recién cuando hay unidad y patente: antes de eso la
  // pregunta no tiene respuesta posible.
  const [parkingCargado, setParking] = useState<ParkingAvailability | null>(null);
  const [parkingAccepted, setParkingAccepted] = useState(true);
  const [parkingResult, setParkingResult] = useState<
    { assigned: boolean; code?: string; error?: string } | null
  >(null);

  // ── ¿La patente es de un residente? ─────────────────────────────
  const [autoResidente, setAutoResidente] = useState<{
    plate: string;
    model: string | null;
    unitCode: string;
    residentName: string;
  } | null>(null);

  // ── Reconocimiento por RUT ──────────────────────────────────────
  // El RUT es lo primero que se pregunta: si el sistema ya conoce a la
  // persona, el conserje solo confirma y no escribe nada más.
  const [lookingUp, setLookingUp]   = useState(false);
  const [visitanteEncontrado, setKnown] = useState<RutLookupResult | null>(null);
  const [confirmadoPorConserje, setConfirmedKnown] = useState(false);
  const [motivo, setMotivo]         = useState<Motivo>("Visita");
  const rutRef = useRef<HTMLInputElement>(null);

  // Con 7 dígitos ya se puede buscar e ingresar: hay visitas con
  // pasaporte o documento extranjero. El dígito verificador se avisa
  // como posible tipeo, pero no bloquea el registro.
  const rutValido = normalizeRut(rut).length >= 7;
  const dvSospechoso = rutValido && !isValidRut(rut);

  // ── Lo que se muestra se deriva; no se guarda ────────────────────
  // Cuando el conserje borra el RUT o acorta el nombre, lo que se había
  // consultado deja de aplicar. Antes eso se limpiaba con `setState`
  // dentro de efectos, lo que obligaba a un render extra por cada
  // tecla; calculado acá, el dato simplemente deja de existir.
  const known = rutValido ? visitanteEncontrado : null;
  const confirmedKnown = rutValido && confirmadoPorConserje;

  // Ficha por confirmar: el conserje todavía no dijo "sí, es él"
  const showKnownCard = !!known?.found && !confirmedKnown;

  // El formulario se abre recién cuando hay un RUT válido: sin identidad
  // no hay registro.
  const showIdentitySection = rutValido && !showKnownCard;
  const showDeptSection     = showIdentitySection && name.trim().length >= 2;

  // El depto elegido se olvida si el nombre vuelve a quedar corto: el
  // formulario retrocede al paso anterior.
  const selectedUnit = showDeptSection ? unitElegida : null;

  const showPlateSection    = showDeptSection && !!selectedUnit;
  const canRegister         = rutValido && name.trim().length >= 2 && !!selectedUnit;
  // El botón apagado tiene que decir por qué: si no, el conserje aprieta y
  // aprieta sin saber qué le falta llenar.
  const queFalta = !rutValido
    ? "Falta el RUT de la visita"
    : name.trim().length < 2
      ? "Falta el nombre de la visita"
      : !selectedUnit
        ? "Falta elegir el departamento al que va"
        : null;
  const hayPatente          = plate.trim().length >= 4;

  const passCheck = selectedUnit && name.trim().length >= 2 ? passEncontrado : null;
  // Se muestra apenas hay departamento: si el auto está afuera esperando, el
  // conserje tiene que poder decir "no hay" antes de pedirle la patente.
  const parking   = open && selectedUnit ? parkingCargado : null;
  const autoDeResidente = hayPatente ? autoResidente : null;

  useResetOnOpen(open, () => {
    setName(""); setRut(""); setUnitQuery(""); setSelectedUnit(null); setPlate("");
    setSaving(false); setSuccess(false); savingRef.current = false;
    setPassCheck(null); setWaitError(null); setSaveError(null); setAuthorizedBy("");
    setKnown(null); setConfirmedKnown(false); setMotivo("Visita");
    setParking(null); setParkingAccepted(true); setParkingResult(null);
    setAutoResidente(null);
    resetWait();
  });
  // El cursor arranca en el RUT: "buenos días, su RUT por favor".
  useFocusOnOpen(open, rutRef);

  // El auto puede ser de un residente, no de una visita. Vale la pena
  // decirlo antes de registrarlo como si viniera de afuera.
  useEffect(() => {
    if (!open || !hayPatente) return;
    let cancelled = false;
    const id = setTimeout(async () => {
      try {
        const res = await lookupPlate(plate);
        if (!cancelled) setAutoResidente(res);
      } catch {
        if (!cancelled) setAutoResidente(null);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [open, plate, hayPatente]);

  // Hay auto y hay depto: recién ahí tiene sentido preguntar dónde se
  // estaciona. Se vuelve a consultar si cambia el depto, porque la
  // respuesta depende de cuál es.
  useEffect(() => {
    // Se consulta al elegir el departamento, no al escribir la patente: el
    // auto ya está en la puerta y el conserje tiene que poder decirle "no hay"
    // antes de pedirle nada más.
    if (!open || !selectedUnit) return;
    let cancelled = false;
    const id = setTimeout(async () => {
      try {
        const res = await getParkingForUnit(selectedUnit.unit);
        if (!cancelled) {
          setParking(res);
          setParkingAccepted(!!res?.suggestion);
        }
      } catch {
        if (!cancelled) setParking(null);
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [open, selectedUnit]);

  // Con el RUT completo se consulta al sistema. Si lo conoce, aparece la
  // ficha para confirmar de un toque.
  useEffect(() => {
    if (!rutValido) return;
    let cancelled = false;

    const id = setTimeout(async () => {
      // El "buscando…" se enciende recién cuando la consulta sale: si se
      // encendiera al tipear cada dígito, parpadearía siete veces.
      setLookingUp(true);
      try {
        const res = await lookupVisitorByRut(rut);
        if (cancelled) return;
        setKnown(res);
        if (!res.found) {
          // Desconocido: se llena a mano, partiendo por el nombre.
          setTimeout(() => nameRef.current?.focus(), 60);
        }
      } catch {
        if (!cancelled) setKnown({ found: false });
      } finally {
        if (!cancelled) setLookingUp(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [rut, rutValido]);

  /** "Sí, es él": rellena todo lo que el sistema ya sabía. */
  function aceptarConocido() {
    const v = known?.visitor;
    const p = known?.pass;

    // Un pase manda sobre el historial: es la unidad diciendo a quién
    // espera hoy, con nombre y departamento.
    if (p) {
      setName(p.visitorName);
      const resident = residents.find((r) => r.id === p.residentId) ??
        residents.find((r) => r.unit === p.unitCode);
      if (resident) setSelectedUnit(resident);
      setPassCheck({
        hasPass: true,
        passId: p.id,
        authorizedBy: p.authorizedBy,
        validUntil: p.validUntil,
        note: p.note ?? undefined,
        canRequest: true,
      });
      setConfirmedKnown(true);
      return;
    }

    if (!v) return;
    setName(v.name);
    if (v.plate) setPlate(v.plate);
    if (known?.residentId) {
      const resident = residents.find((r) => r.id === known.residentId);
      if (resident) setSelectedUnit(resident);
    } else if (v.unit) {
      const resident = residents.find((r) => r.unit === v.unit);
      if (resident) setSelectedUnit(resident);
    }
    setConfirmedKnown(true);
  }

  /** "No es él / cambió de depto": se sigue a mano con el RUT ya puesto. */
  function editarConocido() {
    const v = known?.visitor;
    if (v) setName(v.name);
    setConfirmedKnown(true);
    setTimeout(() => nameRef.current?.focus(), 60);
  }

  // ¿Este visitante ya viene anunciado por la unidad? Se consulta al
  // elegir el depto y al terminar de escribir el nombre.
  useEffect(() => {
    if (!selectedUnit || name.trim().length < 2) return;
    let cancelled = false;
    const id = setTimeout(async () => {
      try {
        const res = await checkPassForVisitor({
          residentId: selectedUnit.id,
          visitorName: name.trim(),
          visitorRut: rut.trim() || undefined,
        });
        if (!cancelled) setPassCheck(res);
      } catch {
        if (!cancelled) setPassCheck(null);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
    // `rut` sí importa: el pase se busca por RUT además de por nombre, y sin
    // esta dependencia una corrección del RUT no volvía a consultarlo.
  }, [selectedUnit, name, rut]);

  // Mientras la unidad decide: consultar el estado y correr el reloj.
  useEffect(() => {
    if (!requestId || waitStatus !== "pendiente") return;

    const poll = setInterval(async () => {
      const res = await pollAccessRequest(requestId);
      if (!res) return;
      if (res.status !== "pendiente") {
        setWaitStatus(res.status);
        setRespondedBy(res.respondedBy);
      }
    }, 2000);

    const tick = setInterval(() => {
      if (expiresAt) setRemaining(Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000)));
    }, 500);

    return () => {
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [requestId, waitStatus, expiresAt]);

  // Autorizada: se registra el ingreso solo, con el nombre de quien autorizó.
  useEffect(() => {
    if (waitStatus === "aprobada" && requestId && !savingRef.current && !success) {
      handleRegister({
        requestId,
        authorizedBy: `${respondedBy ?? "La unidad"} · app`,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waitStatus]);

  useEffect(() => {
    if (success) {
      const id = setTimeout(onClose, 2000);
      return () => clearTimeout(id);
    }
  }, [success, onClose]);

  // Que el depto se olvide cuando el nombre queda corto ya no necesita un
  // efecto: `selectedUnit` se deriva de `showDeptSection` más arriba.

  // Frequent visitor matches
  const nameQ = name.trim().toLowerCase();
  const frequentMatches = nameQ.length >= 2
    ? frequentVisitors.filter((v) => v.name.toLowerCase().includes(nameQ))
    : [];

  // Resident search
  const unitQ = unitQuery.trim().toLowerCase();
  const residentMatches = unitQ.length >= 1 && !selectedUnit
    ? residents.filter(
        (r) =>
          r.unit.toLowerCase().includes(unitQ) ||
          r.name.toLowerCase().includes(unitQ) ||
          (r.household ?? "").toLowerCase().includes(unitQ)
      ).slice(0, 5)
    : [];

  function handleFrequentSelect(v: FrequentVisitor) {
    const resident = residents.find((r) => r.unit === v.unit);
    setName(v.name);
    setRut(v.rut ?? "");
    if (resident) {
      setSelectedUnit(resident);
      setUnitQuery("");
    }
  }

  async function handleRegister(opts?: { requestId?: string; authorizedBy?: string }) {
    if (!canRegister || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      const context = motivo === "Visita" ? "Visita" : motivo;
      const result = await registerEntry({
        type: "in",
        who: name.trim(),
        context,
        unit: selectedUnit?.unit || undefined,
        plate: plate.trim() || undefined,
        requestId: opts?.requestId,
        authorizedBy: opts?.authorizedBy,
        rut: rut.trim() || undefined,
        reason: motivo,
        parkingSpotId:
          hayPatente && parkingAccepted ? parking?.suggestion?.spot.id : undefined,
      });
      // Si el lugar se ocupó entremedio, el ingreso igual quedó registrado:
      // se avisa en la pantalla de éxito para que el conserje reubique el auto.
      setParkingResult(result.parking ?? null);
      onRegistered({
        id: result.id,
        t: new Date(result.recorded_at).toLocaleTimeString("es-CL", { timeZone: "America/Santiago", hour: "2-digit", minute: "2-digit", hour12: false }),
        dir: "in",
        who: result.who,
        ctx: "Visita",
        unit: result.unit ?? selectedUnit?.unit ?? "",
        plate: result.plate,
        by: result.recorded_by ?? "",
      });
      setSavedBy(result.recorded_by ?? "");
      setAuthorizedBy(opts?.authorizedBy ?? "");
      setSuccess(true);
    } catch (err) {
      setSaveError(
        `No se guardó el ingreso. ${mensajeParaPersona(err, "registrar visita")}`
      );
    } finally {
      setSaving(false);
      savingRef.current = false;
    }
  }

  // ── Citófono ────────────────────────────────────────────────────

  /** Ingreso respaldado por un pase que el residente dejó listo antes. */
  async function handleRegisterWithPass() {
    if (!passCheck?.hasPass || !passCheck.passId) return;
    await consumePass(passCheck.passId);
    await handleRegister({
      authorizedBy: `Pase previo · ${passCheck.authorizedBy ?? "la unidad"}`,
    });
  }

  /** Toca el timbre digital: la unidad decide si sube o no. */
  async function handleAskAuthorization() {
    if (!canRegister || !selectedUnit || waiting) return;
    setWaitError(null);
    setWaiting(true);
    setWaitStatus("pendiente");

    const res = await createAccessRequest({
      residentId: selectedUnit.id,
      unitCode: selectedUnit.unit,
      visitorName: name.trim(),
      visitorRut: rut.trim() || undefined,
      plate: plate.trim() || undefined,
    });

    if (!res.ok || !res.requestId) {
      setWaiting(false);
      setWaitError(res.error ?? "No se pudo avisar a la unidad");
      return;
    }

    setRequestId(res.requestId);
    setExpiresAt(res.expiresAt ?? null);
    // Arrancar el reloj de inmediato: si no, el primer tick llega medio
    // segundo después y el conserje ve "0s" en la pantalla de espera.
    if (res.expiresAt) {
      setRemaining(Math.max(0, Math.ceil((new Date(res.expiresAt).getTime() - Date.now()) / 1000)));
    }
  }

  async function handleCancelWait() {
    if (requestId) await cancelAccessRequest(requestId);
    resetWait();
  }

  function resetWait() {
    setWaiting(false);
    setRequestId(null);
    setExpiresAt(null);
    setWaitStatus(null);
    setRespondedBy(null);
  }

  return (
    <>
      <div
        style={{ position: "fixed", inset: 0, background: "rgba(20,15,8,0.45)", zIndex: 40, opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none", transition: "opacity 0.2s" }}
      />
      <div
        {...atributosDeCajon(open, "Registrar visita")}
        style={{
          position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50,
          background: "var(--px-bone)", borderRadius: "24px 24px 0 0",
          padding: "0 clamp(16px, 5vw, 28px) calc(32px + env(safe-area-inset-bottom, 0px))", maxHeight: "92dvh",
          display: "flex", flexDirection: "column",
          transform: open ? "translateY(0)" : "translateY(100%)",
          transition: "transform 0.28s cubic-bezier(0.32, 0.72, 0, 1)",
          boxShadow: "0 -4px 40px -8px rgba(20,15,8,0.25)",
        }}
      >
        {/* Handle */}
        <div style={{ position: "absolute", top: 10, left: "50%", transform: "translateX(-50%)", width: 40, height: 4, borderRadius: 2, background: "var(--px-line)" }} />

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 16, paddingBottom: 20, flexShrink: 0 }}>
          {!success && (
            <>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em" }}>
                {rutValido ? (showKnownCard ? "¿Es esta persona?" : "¿Quién entra?") : "Su RUT, por favor"}
              </h2>
              <BotonCerrar onClick={onClose} disabled={saving} />
            </>
          )}
        </div>

        {/* ── Success ── */}
        {success && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, textAlign: "center" }}>
            <div style={{ width: 72, height: 72, borderRadius: 36, background: "var(--px-ok)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg viewBox="0 0 24 24" width={32} height={32} fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em" }}>Ingreso registrado</div>
              <div style={{ fontSize: 15, color: "var(--px-mid)", marginTop: 6 }}>
                {name}{selectedUnit ? ` · ${selectedUnit.unit}` : ""}
              </div>
            </div>
            {authorizedBy && (
              <div style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 11, color: "var(--px-ok)", letterSpacing: "0.06em" }}>
                {authorizedBy.toUpperCase()}
              </div>
            )}

            {/* Dónde quedó el auto: es lo que el conserje le repite en voz
                alta al conductor antes de abrir el portón. */}
            {parkingResult?.assigned && parkingResult.code && (
              <div style={{ padding: "10px 18px", borderRadius: 12, background: "oklch(0.95 0.05 150)", border: "1px solid var(--px-ok)" }}>
                <div style={{ fontSize: 15, fontWeight: 600 }}>
                  Estacionamiento {parkingResult.code}
                </div>
              </div>
            )}
            {parkingResult?.error && (
              <div style={{ padding: "10px 18px", borderRadius: 12, background: "oklch(0.96 0.03 25)", border: "1px solid var(--px-alert)", maxWidth: 320 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--px-alert)" }}>
                  {parkingResult.error}
                </div>
                <div style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 10.5, color: "var(--px-ink2)", marginTop: 3 }}>
                  EL INGRESO SÍ QUEDÓ REGISTRADO
                </div>
              </div>
            )}

            <div style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 11, color: "var(--px-mid)" }}>
              {nowTime()}{savedBy ? ` · ${savedBy}` : ""}
            </div>
          </div>
        )}

        {/* ── Esperando a la unidad ── */}
        {!success && waiting && (
          <EsperaAutorizacion
            visitorName={name}
            unit={selectedUnit?.unit ?? ""}
            status={waitStatus}
            respondedBy={respondedBy}
            remaining={remaining}
            saving={saving}
            onCancel={handleCancelWait}
            onRegisterAnyway={() =>
              handleRegister({
                requestId: requestId ?? undefined,
                authorizedBy: "Sin respuesta de la unidad",
              })
            }
            onClose={onClose}
          />
        )}

        {/* ── Form ── */}
        {!success && !waiting && (
          <div style={{ flex: 1, overflow: "auto", minHeight: 0, display: "flex", flexDirection: "column" }}>

            {/* ─ RUT: la identidad, y el atajo de todo el flujo ─ */}
            <div style={{ marginBottom: showKnownCard ? 14 : 16 }}>
              <div style={LABEL}>RUT DEL VISITANTE</div>
              <input aria-label="RUT del visitante"
                ref={rutRef}
                type="text"
                inputMode="numeric"
                value={rut}
                onChange={(e) => setRut(formatRutInput(e.target.value))}
                placeholder="12.345.678-9"
                disabled={saving}
                maxLength={12}
                style={{
                  width: "100%", padding: "16px", fontSize: 24,
                  fontFamily: "var(--font-jetbrains-mono)", letterSpacing: "0.04em",
                  background: "white",
                  border: `1px solid ${dvSospechoso ? "oklch(0.75 0.14 70)" : "var(--px-line)"}`,
                  borderRadius: 12, outline: "none", color: "var(--px-ink)",
                }}
              />
              {dvSospechoso && (
                <div style={{ ...LABEL, color: "oklch(0.55 0.14 70)", marginTop: 6, marginBottom: 0 }}>
                  REVISA EL DÍGITO VERIFICADOR
                </div>
              )}
              {lookingUp && (
                <div style={{ ...LABEL, marginTop: 6, marginBottom: 0 }}>BUSCANDO…</div>
              )}
            </div>

            {/* ─ Lo conocemos: el conserje solo confirma ─ */}
            {showKnownCard && (known?.visitor || known?.pass) && (
              <div style={{ marginBottom: 16 }}>
                <div
                  style={{
                    padding: "18px 20px", borderRadius: 14,
                    background: known.pass ? "oklch(0.95 0.05 150)" : "white",
                    border: `2px solid ${known.pass ? "var(--px-ok)" : "var(--px-ink)"}`,
                  }}
                >
                  {known.pass && (
                    <div style={{ ...LABEL, color: "oklch(0.42 0.12 150)", marginBottom: 8 }}>
                      ANUNCIADA POR {known.pass.authorizedBy.toUpperCase()}
                    </div>
                  )}
                  <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.1 }}>
                    {known.visitor?.name ?? known.pass?.visitorName}
                  </div>
                  <div style={{ fontSize: 15, color: "var(--px-ink2)", marginTop: 6 }}>
                    {known.pass
                      ? `Va al ${known.pass.unitCode} · ${known.pass.residentName}`
                      : known.visitor?.unit
                        ? `Visita habitual · ${known.visitor.unit}${known.residentName ? ` · ${known.residentName}` : ""}`
                        : "Sin departamento habitual registrado"}
                  </div>
                  {known.pass?.note && (
                    <div style={{ fontSize: 14, color: "var(--px-ink2)", marginTop: 8, fontStyle: "italic" }}>
                      “{known.pass.note}”
                    </div>
                  )}
                  <div style={{ ...LABEL, marginTop: 10, marginBottom: 0 }}>
                    {known.pass
                      ? `PASE VÁLIDO HASTA ${nowTimeOf(known.pass.validUntil)}`
                      : `${known.visitor && known.visitor.visitCount > 1 ? `${known.visitor.visitCount} INGRESOS` : "1 INGRESO"}${
                          known.visitor?.lastSeenAt ? ` · ÚLTIMO ${fechaCorta(known.visitor.lastSeenAt)}` : ""
                        }${known.visitor?.reason ? ` · ${known.visitor.reason.toUpperCase()}` : ""}`}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                  <button
                    onClick={editarConocido}
                    disabled={saving}
                    style={{
                      flex: 1, padding: "14px", background: "white",
                      border: "1px solid var(--px-line)", borderRadius: 12,
                      font: "inherit", fontSize: 15, fontWeight: 500,
                      color: "var(--px-ink2)", cursor: "pointer",
                    }}
                  >
                    Corregir datos
                  </button>
                  <button
                    onClick={aceptarConocido}
                    disabled={saving}
                    style={{
                      flex: 1.5, padding: "14px",
                      background: known.pass ? "var(--px-ok)" : "var(--px-ink)",
                      color: known.pass ? "white" : "var(--px-bone)",
                      border: "none", borderRadius: 12,
                      font: "inherit", fontSize: 15.5, fontWeight: 600, cursor: "pointer",
                    }}
                  >
                    Sí, es esa persona
                  </button>
                </div>
              </div>
            )}

            {/* ─ Nombre ─ (solo si hay que llenarlo a mano) */}
            {showIdentitySection && (
            <div style={{ marginBottom: 16 }}>
              <div style={LABEL}>
                {known?.found ? "NOMBRE DEL VISITANTE" : "NO ESTÁ REGISTRADO · NOMBRE COMPLETO"}
              </div>
              <input aria-label="Nombre completo de la visita"
                ref={nameRef}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nombre completo"
                disabled={saving}
                style={{ width: "100%", padding: "14px 16px", fontSize: 18, fontFamily: "var(--font-inter-tight), Inter, system-ui, sans-serif", letterSpacing: "-0.005em", background: "white", border: "1px solid var(--px-line)", borderRadius: 12, outline: "none", color: "var(--px-ink)" }}
              />
              {/* Visitantes frecuentes que coinciden */}
              {frequentMatches.length > 0 && (
                <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                  {frequentMatches.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => handleFrequentSelect(v)}
                      disabled={saving}
                      style={{ background: "white", border: "1px solid var(--px-line)", borderRadius: 10, padding: "10px 14px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", font: "inherit", textAlign: "left" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--px-paper)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "white")}
                    >
                      <div style={{ width: 32, height: 32, borderRadius: 16, background: "var(--px-line)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600, color: "var(--px-ink2)", flexShrink: 0 }}>
                        {initials(v.name)}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 500, fontSize: 14 }}>{v.name}</div>
                        <div style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 11, color: "var(--px-mid)" }}>
                          {[v.unit, v.reason].filter(Boolean).join(" · ")}
                        </div>
                      </div>
                      <span style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 10, color: "var(--px-mid)", background: "var(--px-paper)", padding: "3px 8px", borderRadius: 6, border: "1px solid var(--px-line2)", flexShrink: 0 }}>
                        frecuente
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            )}

            {/* ─ ¿A qué viene? ─ */}
            {showDeptSection && (
              <div style={{ marginBottom: 16 }}>
                <div style={LABEL}>¿A QUÉ VIENE?</div>
                <div style={{ display: "flex", gap: 8 }}>
                  {MOTIVOS.map((m) => (
                    <button
                      key={m}
                      onClick={() => setMotivo(m)}
                      disabled={saving}
                      style={{
                        flex: 1, padding: "12px 10px",
                        background: motivo === m ? "var(--px-ink)" : "white",
                        color: motivo === m ? "var(--px-bone)" : "var(--px-ink2)",
                        border: motivo === m ? "none" : "1px solid var(--px-line)",
                        borderRadius: 11, font: "inherit", fontSize: 14.5,
                        fontWeight: motivo === m ? 600 : 500, cursor: "pointer",
                      }}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ─ Departamento ─ */}
            {showDeptSection && (
              <div style={{ marginBottom: 16 }}>
                <div style={LABEL}>DEPARTAMENTO</div>

                {selectedUnit ? (
                  /* Chip unidad seleccionada */
                  <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: "oklch(0.97 0.03 260)", border: "1px solid oklch(0.88 0.06 260)", borderRadius: 12 }}>
                    <span style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 15, fontWeight: 700, color: "oklch(0.40 0.15 260)", flexShrink: 0 }}>
                      {selectedUnit.unit}
                    </span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 500, fontSize: 14 }}>{selectedUnit.name}</div>
                      {selectedUnit.household && <div style={{ fontSize: 12, color: "var(--px-mid)" }}>{selectedUnit.household}</div>}
                    </div>
                    <button
                      onClick={() => { setSelectedUnit(null); setUnitQuery(""); setPlate(""); }}
                      disabled={saving}
                      style={{ background: "none", border: "none", cursor: saving ? "default" : "pointer", fontFamily: "var(--font-jetbrains-mono)", fontSize: 11, color: "var(--px-mid)", padding: "4px 8px", opacity: saving ? 0.4 : 1, flexShrink: 0 }}
                    >
                      cambiar
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Campo de búsqueda */}
                    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: "white", borderRadius: 12, border: "1px solid var(--px-line)" }}>
                      <IconSearch size={18} style={{ color: "var(--px-mid)", flexShrink: 0 }} />
                      <input aria-label="Departamento o nombre del residente"
                        type="text"
                        value={unitQuery}
                        onChange={(e) => setUnitQuery(e.target.value)}
                        placeholder="N° depto o nombre del residente…"
                        disabled={saving}
                        style={{ flex: 1, border: "none", outline: "none", fontSize: 15, background: "transparent", fontFamily: "var(--font-inter-tight), Inter, system-ui, sans-serif", color: "var(--px-ink)", letterSpacing: "-0.005em" }}
                      />
                    </div>

                    {/* Resultados inline */}
                    {residentMatches.length > 0 && (
                      <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                        {residentMatches.map((r) => (
                          <button
                            key={r.id}
                            onClick={() => { setSelectedUnit(r); setUnitQuery(""); }}
                            disabled={saving}
                            style={{ background: "white", border: "1px solid var(--px-line)", borderRadius: 10, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", font: "inherit", textAlign: "left" }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--px-paper)")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "white")}
                          >
                            <span style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 14, fontWeight: 600, color: "var(--px-ink)", width: 56, flexShrink: 0 }}>{r.unit}</span>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 500, fontSize: 14 }}>{r.name}</div>
                              {r.household && <div style={{ fontSize: 12, color: "var(--px-mid)" }}>{r.household}</div>}
                            </div>
                            <span style={{ color: "var(--px-mid)", fontSize: 16 }}>›</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {unitQ.length >= 1 && residentMatches.length === 0 && (
                      <div style={{ marginTop: 8, padding: "10px", textAlign: "center", color: "var(--px-mid)", fontSize: 13 }}>
                        Sin resultados
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ─ Patente ─ (aparece cuando unidad seleccionada) */}
            {showPlateSection && (
              <div style={{ marginBottom: 16 }}>
                <div style={LABEL}>PATENTE · OPCIONAL</div>
                <input aria-label="Patente (opcional)"
                  type="text"
                  value={plate}
                  onChange={(e) => setPlate(e.target.value.toUpperCase())}
                  placeholder="ej. ABCD·12"
                  maxLength={8}
                  disabled={saving}
                  style={{ width: "100%", padding: "13px 16px", fontSize: 15, fontFamily: "var(--font-jetbrains-mono)", letterSpacing: "0.05em", background: "white", border: "1px solid var(--px-line)", borderRadius: 12, outline: "none", color: "var(--px-ink)" }}
                />

                {/* Este auto ya tiene dueño en el edificio. Puede ser
                    legítimo (el hijo que llega en el auto del papá), así que
                    se avisa sin bloquear nada. */}
                {autoDeResidente && (
                  <div
                    style={{
                      marginTop: 10, padding: "11px 14px", borderRadius: 12,
                      background: "oklch(0.96 0.04 250)",
                      border: "1px solid oklch(0.75 0.10 250)",
                    }}
                  >
                    <div style={{ fontSize: 14, fontWeight: 600 }}>
                      Auto registrado del {autoDeResidente.unitCode}
                    </div>
                    <div style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 10.5, color: "var(--px-ink2)", marginTop: 2 }}>
                      {autoDeResidente.residentName.toUpperCase()}
                      {autoDeResidente.model ? ` · ${autoDeResidente.model.toUpperCase()}` : ""}
                    </div>
                  </div>
                )}

                {/* ─ Estacionamiento ─ Aparece solo cuando hay auto: la
                    pregunta "¿dónde lo dejo?" no existe si vino caminando. */}
                {parking && (
                  <div style={{ marginTop: 10 }}>
                    {parking.suggestion ? (
                      <button
                        type="button"
                        onClick={() => setParkingAccepted((v) => !v)}
                        disabled={saving}
                        style={{
                          width: "100%", textAlign: "left", cursor: saving ? "default" : "pointer",
                          padding: "12px 14px", borderRadius: 12, font: "inherit",
                          background: parkingAccepted ? "oklch(0.95 0.05 150)" : "white",
                          border: `1px solid ${parkingAccepted ? "var(--px-ok)" : "var(--px-line)"}`,
                          display: "flex", alignItems: "center", gap: 12,
                        }}
                      >
                        <span
                          style={{
                            width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                            border: `1.5px solid ${parkingAccepted ? "var(--px-ok)" : "var(--px-mid2)"}`,
                            background: parkingAccepted ? "var(--px-ok)" : "transparent",
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}
                        >
                          {parkingAccepted && (
                            <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </span>
                        <span style={{ minWidth: 0 }}>
                          <span style={{ display: "block", fontSize: 14.5, fontWeight: 600 }}>
                            Estacionamiento {parking.suggestion.spot.code}
                          </span>
                          <span style={{ display: "block", fontFamily: "var(--font-jetbrains-mono)", fontSize: 10.5, color: "var(--px-mid)", marginTop: 2 }}>
                            {parking.suggestion.reason === "prestado"
                              ? `PRESTADO POR EL ${parking.suggestion.spot.unit_code ?? ""}`
                              : parking.suggestion.reason === "unidad"
                              ? `DEL DEPTO ${parking.suggestion.spot.unit_code ?? ""}`
                              : parking.unitSpot?.occupied
                                ? `EL DEL DEPTO (${parking.unitSpot.code}) ESTÁ OCUPADO · SE DA UNO DE VISITA`
                                : parking.freeVisitorSpots === 1
                                  ? "DE VISITA · ÚLTIMO CUPO LIBRE"
                                  : `DE VISITA · QUEDAN ${parking.freeVisitorSpots} LIBRES`}
                          </span>
                        </span>
                      </button>
                    ) : (
                      // Sin cupo: el conserje tiene que saberlo antes de abrir,
                      // no cuando el auto ya está dando vueltas adentro.
                      <div
                        style={{
                          padding: "12px 14px", borderRadius: 12,
                          background: "oklch(0.96 0.03 25)", border: "1px solid var(--px-alert)",
                        }}
                      >
                        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--px-alert)" }}>
                          Sin estacionamiento disponible
                        </div>
                        <div style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 10.5, color: "var(--px-ink2)", marginTop: 2 }}>
                          {parking.unitSpot?.occupied ? `${parking.unitSpot.code} OCUPADO · ` : ""}
                          {parking.totalVisitorSpots === 0
                            ? "EL EDIFICIO NO TIENE CUPOS DE VISITA"
                            : parking.totalVisitorSpots === 1
                              ? "EL ÚNICO DE VISITA ESTÁ OCUPADO"
                              : `LOS ${parking.totalVisitorSpots} DE VISITA ESTÁN OCUPADOS`}
                          {" · EL AUTO QUEDA FUERA"}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div style={{ flex: 1, minHeight: 12 }} />

            {/* ─ Pase vigente: la unidad ya lo anunció ─ */}
            {passCheck?.hasPass && (
              <div
                style={{
                  marginBottom: 12, padding: "13px 15px", borderRadius: 12,
                  background: "oklch(0.95 0.05 150)", border: "1px solid var(--px-ok)",
                  display: "flex", alignItems: "center", gap: 12,
                }}
              >
                <span style={{ color: "var(--px-ok)", display: "flex", flexShrink: 0 }}>
                  <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 600, color: "var(--px-ink)" }}>
                    Visita anunciada por {passCheck.authorizedBy}
                  </div>
                  <div style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 11, color: "var(--px-ink2)", marginTop: 2 }}>
                    {passCheck.note ? `${passCheck.note.toUpperCase()} · ` : ""}
                    VÁLIDO HASTA {passCheck.validUntil ? nowTimeOf(passCheck.validUntil) : ""}
                  </div>
                </div>
              </div>
            )}

            {(waitError || saveError) && (
              <div role="alert" style={{ marginBottom: 12, padding: "11px 14px", borderRadius: 12, background: "oklch(0.96 0.03 25)", border: "1px solid var(--px-alert)", fontSize: 13.5, color: "var(--px-alert)" }}>
                {saveError ?? waitError}
              </div>
            )}

            {/* Botón principal: cambia según cómo se autoriza este ingreso */}
            {passCheck?.hasPass ? (
              <button
                onClick={handleRegisterWithPass}
                disabled={!canRegister || saving}
                aria-describedby={queFalta ? "visita-que-falta" : undefined}
                style={{
                  width: "100%", padding: "16px",
                  background: canRegister && !saving ? "var(--px-ok)" : "var(--px-line)",
                  color: "white", border: "none", borderRadius: 14,
                  font: "inherit", fontSize: 17, fontWeight: 600, letterSpacing: "-0.01em",
                  cursor: canRegister && !saving ? "pointer" : "not-allowed",
                  flexShrink: 0,
                }}
              >
                {saving ? "Guardando…" : "Confirmar y registrar ingreso"}
              </button>
            ) : passCheck?.canRequest ? (
              <button
                onClick={handleAskAuthorization}
                disabled={!canRegister || saving}
                aria-describedby={queFalta ? "visita-que-falta" : undefined}
                style={{
                  width: "100%", padding: "16px",
                  background: canRegister && !saving ? "var(--px-ink)" : "var(--px-line)",
                  color: "var(--px-bone)", border: "none", borderRadius: 14,
                  font: "inherit", fontSize: 17, fontWeight: 600, letterSpacing: "-0.01em",
                  cursor: canRegister && !saving ? "pointer" : "not-allowed",
                  flexShrink: 0,
                }}
              >
                Avisar al departamento
              </button>
            ) : (
              <button
                onClick={() => handleRegister()}
                disabled={!canRegister || saving}
                aria-describedby={queFalta ? "visita-que-falta" : undefined}
                style={{
                  width: "100%", padding: "16px",
                  background: canRegister && !saving ? "var(--px-ink)" : "var(--px-line)",
                  color: "var(--px-bone)", border: "none", borderRadius: 14,
                  font: "inherit", fontSize: 17, fontWeight: 600, letterSpacing: "-0.01em",
                  cursor: canRegister && !saving ? "pointer" : "not-allowed",
                  flexShrink: 0,
                }}
              >
                {saving ? "Guardando…" : "Registrar ingreso"}
              </button>
            )}

            {queFalta && !saving && (
              <div id="visita-que-falta" aria-live="polite" style={{ marginTop: 10, fontSize: 14, color: "var(--px-ink2)", textAlign: "center" }}>
                {queFalta}
              </div>
            )}

            {selectedUnit && passCheck && !passCheck.canRequest && !passCheck.hasPass && (
              <div style={{ ...LABEL, marginTop: 10, marginBottom: 0, textAlign: "center" }}>
                ESTA UNIDAD AÚN NO USA LA APP
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

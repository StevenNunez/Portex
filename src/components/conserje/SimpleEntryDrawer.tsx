"use client";

import { useState, useEffect, useRef } from "react";
import { registerEntry } from "@/app/actions";
import { IconSearch } from "@/components/icons";
import type { ActivityItem, Resident } from "@/lib/mock-data";
import type { AccessType } from "@/lib/database.types";
import { formatRutInput, normalizeRut } from "@/lib/rut";
import { useFocusOnOpen, useResetOnOpen } from "@/lib/drawer";
import { NOTICE_CHIP, NOTICE_KINDS, type NoticeKind } from "@/lib/avisos-tipos";

export type EntryType = "entrega" | "provider";

interface Props {
  type: EntryType;
  open: boolean;
  onClose: () => void;
  onRegistered: (item: ActivityItem) => void;
  residents: Resident[];
}

// ── Plataformas agrupadas ──────────────────────────────────────────────────
interface Platform { name: string; accessType: "delivery" | "parcel" }

const FOOD_PLATFORMS: Platform[] = [
  { name: "Rappi",      accessType: "delivery" },
  { name: "Pedidos Ya", accessType: "delivery" },
  { name: "Uber Eats",  accessType: "delivery" },
];
const COURIER_PLATFORMS: Platform[] = [
  { name: "Chilexpress",  accessType: "parcel" },
  { name: "Correos",      accessType: "parcel" },
  { name: "Blue Express", accessType: "parcel" },
  { name: "Amazon",       accessType: "parcel" },
];

function nowTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function initials(name: string) {
  return name.split(" ").slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

const MONO: React.CSSProperties = {
  fontFamily: "var(--font-jetbrains-mono)",
  fontSize: 10, letterSpacing: "0.08em", color: "var(--px-mid)", marginBottom: 8,
};

const FIELD_INPUT: React.CSSProperties = {
  width: "100%", padding: "12px 16px", fontSize: 15,
  fontFamily: "var(--font-inter-tight), Inter, system-ui, sans-serif",
  background: "white", border: "1px solid var(--px-line)",
  borderRadius: 10, outline: "none", color: "var(--px-ink)",
};

const DRAWER: React.CSSProperties = {
  position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50,
  background: "var(--px-bone)", borderRadius: "24px 24px 0 0",
  padding: "0 28px 36px", maxHeight: "82dvh",
  display: "flex", flexDirection: "column",
};

export default function SimpleEntryDrawer({ type, open, onClose, onRegistered, residents }: Props) {
  const [step, setStep]                   = useState<"who" | "unit" | "confirm" | "success">("who");
  const [who, setWho]                     = useState("");
  const [reason, setReason]               = useState("");
  const [unitQuery, setUnitQuery]         = useState("");
  const [selectedResident, setSelectedResident] = useState<Resident | null>(null);
  const [accessType, setAccessType]       = useState<AccessType>(
    type === "provider" ? "provider" : "parcel"
  );
  const [rut, setRut]                     = useState("");
  const [saving, setSaving]               = useState(false);

  // Qué viene a hacer el proveedor y a quién le afecta. Sin esto, "llegó
  // VTR al 1204" y "cortan el agua de todo el edificio" eran la misma línea.
  const [servicio, setServicio]           = useState<NoticeKind | null>(null);
  const [horas, setHoras]                 = useState<number | null>(2);
  const [todoElEdificio, setTodoElEdificio] = useState(false);

  // El proveedor entra al condominio, así que su documento es obligatorio.
  // El delivery deja en portería y no sube: ahí el RUT no se pide.
  const puedeSeguirProveedor = who.trim().length >= 2 && normalizeRut(rut).length >= 7;

  const inputRef = useRef<HTMLInputElement>(null);

  useResetOnOpen(
    open,
    () => {
      setStep("who");
      setWho(""); setReason(""); setUnitQuery(""); setRut("");
      setSelectedResident(null); setSaving(false);
      // El tipo depende de para qué se abrió el drawer: es el mismo
      // componente para Entrega y Proveedor.
      setAccessType(type === "provider" ? "provider" : "parcel");
      setServicio(null); setHoras(2); setTodoElEdificio(false);
    },
    type
  );
  useFocusOnOpen(open, inputRef);

  useEffect(() => {
    if (step === "success") {
      const id = setTimeout(onClose, 1800);
      return () => clearTimeout(id);
    }
  }, [step, onClose]);

  function handlePlatformSelect(p: Platform) {
    setWho(p.name);
    setAccessType(p.accessType);
    setStep("unit");
  }

  function handleWhoNext() {
    if (!who.trim()) return;
    setStep("unit");
  }

  function handleSelectResident(r: Resident) {
    setSelectedResident(r);
    setStep("confirm");
  }

  async function handleConfirm() {
    setSaving(true);
    const contextPrefix = accessType === "delivery" ? "Delivery"
      : accessType === "parcel" ? "Encomienda"
      : "Proveedor";
    const context = reason.trim() ? `${contextPrefix} · ${reason.trim()}` : contextPrefix;
    try {
      const result = await registerEntry({
        type: accessType,
        who: who.trim(),
        context,
        unit: selectedResident?.unit || undefined,
        rut: rut.trim() || undefined,
        reason: contextPrefix,
        servicio:
          type === "provider" && servicio
            ? {
                kind: servicio,
                scope: todoElEdificio || !selectedResident ? "edificio" : "unidad",
                horas: horas ?? undefined,
              }
            : undefined,
      });
      onRegistered({
        id: result.id,
        t: new Date(result.recorded_at).toLocaleTimeString("es-CL", { timeZone: "America/Santiago", hour: "2-digit", minute: "2-digit", hour12: false }),
        dir: accessType,
        who: result.who,
        ctx: context,
        unit: result.unit ?? "",
        plate: null,
        by: result.recorded_by ?? "",
      });
      setStep("success");
    } finally {
      setSaving(false);
    }
  }

  const filteredResidents = unitQuery.trim()
    ? residents.filter((r) =>
        r.unit.toLowerCase().includes(unitQuery.toLowerCase()) ||
        r.name.toLowerCase().includes(unitQuery.toLowerCase())
      )
    : residents;

  const contextPrefix = accessType === "delivery" ? "Delivery"
    : accessType === "parcel" ? "Encomienda"
    : "Proveedor";

  const title = step === "success" ? ""
    : type === "entrega" && step === "who" ? "¿Quién entrega?"
    : type === "entrega" ? "Entrega"
    : "Proveedor";

  return (
    <>
      <div style={{ position: "fixed", inset: 0, background: "rgba(20,15,8,0.45)", zIndex: 40, opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none", transition: "opacity 0.2s" }} />
      <div style={{ ...DRAWER, transform: open ? "translateY(0)" : "translateY(100%)", transition: "transform 0.28s cubic-bezier(0.32, 0.72, 0, 1)", boxShadow: "0 -4px 40px -8px rgba(20,15,8,0.25)" }}>

        {/* Handle */}
        <div style={{ position: "absolute", top: 10, left: "50%", transform: "translateX(-50%)", width: 40, height: 4, borderRadius: 2, background: "var(--px-line)" }} />

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 22, paddingBottom: 20, flexShrink: 0 }}>
          {step !== "success" && (
            <>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em" }}>{title}</h2>
              <button onClick={onClose} style={{ background: "var(--px-paper)", border: "1px solid var(--px-line)", borderRadius: 20, width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--px-mid)", fontSize: 18 }}>×</button>
            </>
          )}
        </div>

        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>

          {/* ── Success ── */}
          {step === "success" && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, textAlign: "center" }}>
              <div style={{ width: 64, height: 64, borderRadius: 32, background: "var(--px-ok)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg viewBox="0 0 24 24" width={28} height={28} fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
              </div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.02em" }}>
                  {accessType === "parcel" ? "Encomienda registrada" : `${contextPrefix} registrado`}
                </div>
                <div style={{ fontSize: 14, color: "var(--px-mid)", marginTop: 4 }}>
                  {who}{selectedResident ? ` · ${selectedResident.unit}` : ""}
                </div>
              </div>
            </div>
          )}

          {/* ── Who step: Entrega (delivery + courier unificado) ── */}
          {step === "who" && type === "entrega" && (
            <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column", gap: 16 }}>

              {/* Grupo: Delivery de comida */}
              <div>
                <div style={MONO}>DELIVERY DE COMIDA</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                  {FOOD_PLATFORMS.map((p) => (
                    <button
                      key={p.name}
                      onClick={() => handlePlatformSelect(p)}
                      style={{
                        padding: "11px 8px", background: who === p.name ? "var(--px-ink)" : "white",
                        color: who === p.name ? "var(--px-bone)" : "var(--px-ink)",
                        border: who === p.name ? "2px solid var(--px-ink)" : "1px solid var(--px-line)",
                        borderRadius: 10, cursor: "pointer", font: "inherit", fontSize: 13, fontWeight: 500,
                      }}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Grupo: Courier / encomienda */}
              <div>
                <div style={MONO}>COURIER / ENCOMIENDA</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {COURIER_PLATFORMS.map((p) => (
                    <button
                      key={p.name}
                      onClick={() => handlePlatformSelect(p)}
                      style={{
                        padding: "11px 14px", background: who === p.name ? "var(--px-ink)" : "white",
                        color: who === p.name ? "var(--px-bone)" : "var(--px-ink)",
                        border: who === p.name ? "2px solid var(--px-ink)" : "1px solid var(--px-line)",
                        borderRadius: 10, cursor: "pointer", font: "inherit", fontSize: 13, fontWeight: 500,
                      }}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Campo manual */}
              <div>
                <div style={MONO}>O ESCRIBE EL NOMBRE</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    ref={inputRef}
                    value={who}
                    onChange={(e) => setWho(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && who.trim()) handleWhoNext(); }}
                    placeholder="Nombre de la empresa…"
                    style={{ ...FIELD_INPUT, width: "auto", flex: 1 }}
                  />
                  <button
                    onClick={handleWhoNext}
                    disabled={!who.trim()}
                    style={{ padding: "12px 18px", background: who.trim() ? "var(--px-ink)" : "var(--px-line)", color: "var(--px-bone)", border: "none", borderRadius: 10, font: "inherit", fontSize: 15, fontWeight: 600, cursor: who.trim() ? "pointer" : "not-allowed", flexShrink: 0 }}
                  >
                    →
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Who step: Proveedor ── */}
          {step === "who" && type === "provider" && (
            <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 14 }}>
              <div>
                <div style={MONO}>NOMBRE / EMPRESA</div>
                <input
                  ref={inputRef}
                  value={who}
                  onChange={(e) => setWho(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && who.trim()) setStep("unit"); }}
                  placeholder="Ej: Empresa Mantención S.A."
                  style={FIELD_INPUT}
                />
              </div>
              <div>
                {/* El proveedor sube al edificio: entra igual que una
                    visita, así que se identifica igual que una visita. */}
                <div style={MONO}>RUT DE QUIEN INGRESA</div>
                <input
                  value={rut}
                  onChange={(e) => setRut(formatRutInput(e.target.value))}
                  placeholder="12.345.678-9"
                  maxLength={12}
                  style={{ ...FIELD_INPUT, fontFamily: "var(--font-jetbrains-mono)", letterSpacing: "0.03em" }}
                />
              </div>
              <div>
                <div style={MONO}>MOTIVO · OPCIONAL</div>
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Ej: Reparación caldera"
                  style={FIELD_INPUT}
                />
              </div>

              {/* Qué viene a hacer. Si se elige algo, el edificio se entera:
                  al residente le llega el aviso y queda publicado hasta que
                  el trabajo termina. */}
              <div>
                <div style={MONO}>¿QUÉ VIENE A HACER? · AVISA AL EDIFICIO</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {NOTICE_KINDS.filter((k) => k !== "otro").map((k) => {
                    const activo = servicio === k;
                    return (
                      <button
                        key={k}
                        onClick={() => setServicio(activo ? null : k)}
                        style={{
                          padding: "9px 13px",
                          background: activo ? "var(--px-ink)" : "white",
                          color: activo ? "var(--px-bone)" : "var(--px-ink)",
                          border: activo ? "2px solid var(--px-ink)" : "1px solid var(--px-line)",
                          borderRadius: 999, cursor: "pointer", font: "inherit",
                          fontSize: 13, fontWeight: 500,
                        }}
                      >
                        {NOTICE_CHIP[k]}
                      </button>
                    );
                  })}
                </div>
              </div>

              {servicio && (
                <div>
                  <div style={MONO}>¿CUÁNTO VA A DURAR?</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {[1, 2, 4, 8].map((h) => {
                      const activo = horas === h;
                      return (
                        <button
                          key={h}
                          onClick={() => setHoras(h)}
                          style={{
                            flex: 1, padding: "10px 0",
                            background: activo ? "var(--px-ink)" : "white",
                            color: activo ? "var(--px-bone)" : "var(--px-ink)",
                            border: activo ? "2px solid var(--px-ink)" : "1px solid var(--px-line)",
                            borderRadius: 10, cursor: "pointer", font: "inherit",
                            fontSize: 14, fontWeight: 500,
                          }}
                        >
                          {h === 8 ? "Todo el día" : `${h} h`}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div style={{ flex: 1 }} />
              <button
                onClick={() => setStep("unit")}
                disabled={!puedeSeguirProveedor}
                style={{ width: "100%", padding: "14px", background: puedeSeguirProveedor ? "var(--px-ink)" : "var(--px-line)", color: "var(--px-bone)", border: "none", borderRadius: 12, font: "inherit", fontSize: 15, fontWeight: 600, cursor: puedeSeguirProveedor ? "pointer" : "not-allowed" }}
              >
                Continuar →
              </button>
            </div>
          )}

          {/* ── Unit step ── */}
          {step === "unit" && (
            <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
              <div style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 10, letterSpacing: "0.08em", color: "var(--px-mid)", marginBottom: 10 }}>
                ¿A QUÉ UNIDAD?
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", background: "white", border: "1px solid var(--px-line)", borderRadius: 10, marginBottom: 12 }}>
                <IconSearch size={16} style={{ color: "var(--px-mid)", flexShrink: 0 }} />
                <input
                  ref={inputRef}
                  value={unitQuery}
                  onChange={(e) => setUnitQuery(e.target.value)}
                  placeholder="Buscar residente o depto…"
                  style={{ flex: 1, border: "none", outline: "none", fontSize: 15, background: "transparent", fontFamily: "var(--font-inter-tight), Inter, system-ui, sans-serif", color: "var(--px-ink)" }}
                />
              </label>

              {type === "provider" && servicio && (
                <button
                  onClick={() => { setTodoElEdificio(true); setSelectedResident(null); setStep("confirm"); }}
                  style={{
                    width: "100%", padding: "14px 16px", marginBottom: 12,
                    background: "oklch(0.96 0.04 250)", border: "1px solid oklch(0.70 0.12 250)",
                    borderRadius: 12, cursor: "pointer", textAlign: "left",
                    font: "inherit", color: "var(--px-ink)",
                  }}
                >
                  <div style={{ fontSize: 15, fontWeight: 600 }}>Es para todo el edificio</div>
                  <div style={{ fontSize: 13, color: "var(--px-ink2)", marginTop: 2 }}>
                    Se le avisa a todos los departamentos con app
                  </div>
                </button>
              )}

              <button
                onClick={() => { setTodoElEdificio(false); setSelectedResident(null); setStep("confirm"); }}
                style={{ marginBottom: 8, padding: "10px 14px", background: "var(--px-paper)", border: "1px dashed var(--px-line)", borderRadius: 10, font: "inherit", fontSize: 13, color: "var(--px-mid)", cursor: "pointer", textAlign: "left" }}
              >
                Área común / sin unidad específica
              </button>

              <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
                {filteredResidents.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => handleSelectResident(r)}
                    style={{ background: "white", border: "1px solid var(--px-line)", borderRadius: 10, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", font: "inherit", textAlign: "left" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--px-paper)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "white")}
                  >
                    <span style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 12, fontWeight: 500, width: 60, flexShrink: 0 }}>{r.unit}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 500, fontSize: 14 }}>{r.name}</div>
                      {r.household && <div style={{ fontSize: 12, color: "var(--px-mid)" }}>{r.household}</div>}
                    </div>
                    <span style={{ color: "var(--px-mid)" }}>›</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Confirm step ── */}
          {step === "confirm" && (
            <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
              <div style={{ background: "var(--px-paper)", border: "1px solid var(--px-line)", borderRadius: 14, padding: "18px 20px", marginBottom: 16 }}>
                <div style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 10, letterSpacing: "0.08em", color: "var(--px-mid)", marginBottom: 14 }}>CONFIRMAR {contextPrefix.toUpperCase()}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 21, background: "var(--px-ink)", color: "var(--px-bone)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 600, flexShrink: 0 }}>
                    {initials(who)}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 17, letterSpacing: "-0.01em" }}>{who}</div>
                    {reason && <div style={{ fontSize: 13, color: "var(--px-mid)" }}>{reason}</div>}
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, paddingTop: 14, borderTop: "1px solid var(--px-line)" }}>
                  <div>
                    <div style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 10, color: "var(--px-mid)", marginBottom: 4 }}>UNIDAD</div>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>{selectedResident?.unit ?? "Área común"}</div>
                    {selectedResident?.name && <div style={{ fontSize: 12, color: "var(--px-mid)" }}>{selectedResident.name}</div>}
                  </div>
                  <div>
                    <div style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 10, color: "var(--px-mid)", marginBottom: 4 }}>HORA</div>
                    <div style={{ fontWeight: 600, fontSize: 15, fontFamily: "var(--font-jetbrains-mono)" }}>{nowTime()}</div>
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <div style={MONO}>NOTAS · OPCIONAL</div>
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Ej: Paquete grande, fragil…"
                  style={FIELD_INPUT}
                />
              </div>

              <div style={{ flex: 1 }} />
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={() => setStep("who")}
                  style={{ padding: "14px 18px", background: "white", border: "1px solid var(--px-line)", borderRadius: 12, cursor: "pointer", font: "inherit", fontSize: 14, color: "var(--px-ink2)" }}
                >
                  ← Atrás
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={saving}
                  style={{ flex: 1, padding: "14px", background: saving ? "var(--px-mid)" : "var(--px-ink)", color: "var(--px-bone)", border: "none", borderRadius: 12, font: "inherit", fontSize: 15, fontWeight: 600, cursor: saving ? "default" : "pointer" }}
                >
                  {saving ? "Guardando…" : `Registrar ${contextPrefix.toLowerCase()}`}
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  );
}

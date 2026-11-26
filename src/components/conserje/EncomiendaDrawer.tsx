"use client";

import { useEffect, useRef, useState } from "react";
import { entregarEncomienda } from "@/app/encomiendas-actions";
import { useResetOnOpen, atributosDeCajon } from "@/lib/drawer";
import type { PendingParcel } from "@/lib/mock-data";
import BotonCerrar from "@/components/BotonCerrar";

interface Props {
  open: boolean;
  onClose: () => void;
  parcels: PendingParcel[];
  onDelivered: (parcelId: string) => void;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const time = d.toLocaleTimeString("es-CL", { timeZone: "America/Santiago", hour: "2-digit", minute: "2-digit", hour12: false });
  if (d.toDateString() === now.toDateString())       return `Hoy ${time}`;
  if (d.toDateString() === yesterday.toDateString()) return `Ayer ${time}`;
  return d.toLocaleDateString("es-CL", { timeZone: "America/Santiago", day: "numeric", month: "short" }) + ` ${time}`;
}

function stripPrefix(context: string | null) {
  if (!context) return null;
  const clean = context.replace(/^Encomienda\s*·?\s*/i, "").trim();
  return clean || null;
}

export default function EncomiendaDrawer({ open, onClose, parcels, onDelivered }: Props) {
  const [expandedId, setExpandedId]   = useState<string | null>(null);
  const [recipient, setRecipient]     = useState("");
  const [code, setCode]               = useState("");
  const [confirming, setConfirming]   = useState(false);
  const [justDone, setJustDone]       = useState<string | null>(null);
  const [error, setError]             = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Antes se limpiaba al cerrar, lo que se alcanzaba a ver durante la
  // animación de salida. Limpiar al abrir deja el mismo resultado sin el
  // parpadeo.
  useResetOnOpen(open, () => {
    setExpandedId(null); setRecipient(""); setCode(""); setError(null);
  });

  useEffect(() => {
    if (expandedId) setTimeout(() => inputRef.current?.focus(), 60);
  }, [expandedId]);

  function handleExpand(p: PendingParcel) {
    if (expandedId === p.id) {
      setExpandedId(null); setRecipient(""); setCode(""); setError(null);
      return;
    }
    setExpandedId(p.id);
    setRecipient(p.residentName ?? "");
    setCode("");
    setError(null);
  }

  async function handleConfirm(p: PendingParcel) {
    if (confirming) return;
    const name = recipient.trim() || p.residentName || p.who;
    setConfirming(true);
    setError(null);
    try {
      const res = await entregarEncomienda({
        parcelId: p.id,
        pickedUpBy: name,
        code: code || undefined,
      });
      if (!res.ok) {
        setError(res.error ?? "No se pudo registrar la entrega");
        return;
      }
      setJustDone(p.id);
      setExpandedId(null);
      setTimeout(() => {
        onDelivered(p.id);
        setJustDone(null);
      }, 900);
    } finally {
      setConfirming(false);
    }
  }

  return (
    <>
      <div style={{ position: "fixed", inset: 0, background: "rgba(20,15,8,0.45)", zIndex: 40, opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none", transition: "opacity 0.2s" }} />
      <div {...atributosDeCajon(open, "Encomiendas")} style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50,
        background: "var(--px-bone)", borderRadius: "24px 24px 0 0",
        padding: "0 clamp(16px, 5vw, 28px) calc(36px + env(safe-area-inset-bottom, 0px))", maxHeight: "80dvh",
        display: "flex", flexDirection: "column",
        transform: open ? "translateY(0)" : "translateY(100%)",
        transition: "transform 0.28s cubic-bezier(0.32, 0.72, 0, 1)",
        boxShadow: "0 -4px 40px -8px rgba(20,15,8,0.25)",
      }}>
        <div style={{ position: "absolute", top: 10, left: "50%", transform: "translateX(-50%)", width: 40, height: 4, borderRadius: 2, background: "var(--px-line)" }} />

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 22, paddingBottom: 20, flexShrink: 0 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em" }}>Encomiendas</h2>
            <div style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 11, color: "var(--px-mid)", marginTop: 2 }}>
              {parcels.length === 0 ? "Sin pendientes" : `${parcels.length} sin retirar`}
            </div>
          </div>
          <BotonCerrar onClick={onClose} />
        </div>

        {/* List */}
        <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
          {parcels.length === 0 ? (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, color: "var(--px-mid)", textAlign: "center", paddingBottom: 40 }}>
              <div style={{ fontSize: 36 }}>📭</div>
              <div style={{ fontSize: 15 }}>No hay encomiendas pendientes</div>
            </div>
          ) : (
            parcels.map((p) => {
              const isExpanded = expandedId === p.id;
              const isDone     = justDone === p.id;
              const detail     = stripPrefix(p.context);

              return (
                <div
                  key={p.id}
                  style={{
                    background: isDone ? "oklch(0.96 0.04 145)" : "white",
                    border: `1px solid ${isDone ? "oklch(0.80 0.10 145)" : isExpanded ? "var(--px-ink)" : "var(--px-line)"}`,
                    borderRadius: 12,
                    overflow: "hidden",
                    transition: "border-color 0.15s",
                  }}
                >
                  {/* Fila principal */}
                  <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 14 }}>
                    {/* Depto badge */}
                    <div style={{ flexShrink: 0, textAlign: "center", minWidth: 44 }}>
                      <div style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 13, fontWeight: 700, color: "var(--px-ink)", lineHeight: 1 }}>
                        {p.unit ?? "—"}
                      </div>
                      <div style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 9, color: "var(--px-mid)", letterSpacing: "0.06em", marginTop: 2 }}>DEPTO</div>
                    </div>

                    <div style={{ width: 1, height: 36, background: "var(--px-line)", flexShrink: 0 }} />

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 500, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {p.residentName ?? p.who}
                      </div>
                      <div style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 11, color: "var(--px-mid)", marginTop: 2 }}>
                        {[detail, formatDate(p.recorded_at)].filter(Boolean).join(" · ")}
                      </div>
                    </div>

                    {/* Botón Entregar */}
                    {!isDone && (
                      <button
                        onClick={() => handleExpand(p)}
                        style={{
                          flexShrink: 0, padding: "8px 14px",
                          background: isExpanded ? "var(--px-paper)" : "var(--px-ink)",
                          color: isExpanded ? "var(--px-ink2)" : "var(--px-bone)",
                          border: isExpanded ? "1px solid var(--px-line)" : "none",
                          borderRadius: 8, font: "inherit", fontSize: 13, fontWeight: 600,
                          cursor: "pointer", letterSpacing: "-0.01em", transition: "background 0.15s",
                        }}
                      >
                        {isExpanded ? "Cancelar" : "Entregar"}
                      </button>
                    )}
                    {isDone && (
                      <div style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 16, background: "oklch(0.55 0.15 145)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 16 }}>
                        ✓
                      </div>
                    )}
                  </div>

                  {/* Panel expandible: ¿Quién retira? */}
                  {isExpanded && (
                    <div style={{ padding: "0 16px 16px", borderTop: "1px solid var(--px-line2)" }}>
                      <div style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 10, letterSpacing: "0.08em", color: "var(--px-mid)", margin: "12px 0 8px" }}>
                        ¿QUIÉN RETIRA?
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <input aria-label="Quién retira la encomienda"
                          ref={inputRef}
                          value={recipient}
                          onChange={(e) => setRecipient(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") handleConfirm(p); }}
                          placeholder={p.residentName ?? "Nombre de quien retira…"}
                          style={{
                            flex: 1, padding: "10px 14px", fontSize: 15,
                            fontFamily: "var(--font-inter-tight), Inter, system-ui, sans-serif",
                            background: "var(--px-bone)", border: "1px solid var(--px-line)",
                            borderRadius: 8, outline: "none", color: "var(--px-ink)",
                          }}
                        />
                        {/* El código lo trae quien viene a buscar el paquete: le
                            llegó al teléfono del departamento. Acá no se muestra
                            —solo se comprueba— porque si el conserje pudiera
                            leerlo, verificarlo no probaría nada. */}
                        <input aria-label="Código de retiro"
                          value={code}
                          onChange={(e) => { setCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 6)); setError(null); }}
                          onKeyDown={(e) => { if (e.key === "Enter") handleConfirm(p); }}
                          placeholder="Código"
                          inputMode="numeric"
                          maxLength={6}
                          style={{
                            width: 118, padding: "10px 12px", fontSize: 15,
                            fontFamily: "var(--font-jetbrains-mono)", letterSpacing: "0.08em",
                            textAlign: "center", flexShrink: 0,
                            background: "var(--px-bone)", border: "1px solid var(--px-line)",
                            borderRadius: 8, outline: "none", color: "var(--px-ink)",
                          }}
                        />
                        <button
                          onClick={() => handleConfirm(p)}
                          disabled={confirming}
                          style={{
                            padding: "10px 18px",
                            background: confirming ? "var(--px-mid)" : code.length === 6 ? "var(--px-ok)" : "var(--px-ink)",
                            color: "white", border: "none", borderRadius: 8,
                            font: "inherit", fontSize: 14, fontWeight: 600,
                            cursor: confirming ? "default" : "pointer", flexShrink: 0,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {confirming ? "…" : code.length === 6 ? "Confirmar ✓" : "Entregar sin código"}
                        </button>
                      </div>

                      {error && (
                        <div style={{ marginTop: 10, padding: "9px 12px", borderRadius: 8, background: "oklch(0.96 0.05 28)", border: "1px solid oklch(0.88 0.12 28)", color: "var(--px-alert)", fontSize: 13.5 }}>
                          {error}
                        </div>
                      )}

                      {!error && code.length !== 6 && (
                        <div style={{ marginTop: 10, fontSize: 12.5, color: "var(--px-mid)", lineHeight: 1.5 }}>
                          Sin código queda como <strong>entrega sin verificar</strong>. Sirve igual:
                          queda escrito a nombre de quién se la llevó y que la entregaste tú.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}

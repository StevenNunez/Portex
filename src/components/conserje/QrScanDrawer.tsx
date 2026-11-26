"use client";

import type { CSSProperties } from "react";

import { useCallback, useEffect, useRef, useState } from "react";
import { registerPassEntry } from "@/app/citofono-actions";
import { entregarEncomienda, lookupScan, type ScanResult } from "@/app/encomiendas-actions";
import { formatRut } from "@/lib/rut";
import { useResetOnOpen, atributosDeCajon } from "@/lib/drawer";
import type { ActivityItem } from "@/lib/mock-data";
import BotonCerrar from "@/components/BotonCerrar";

/**
 * La pantalla de escanear de portería.
 *
 * Lo que le muestran al conserje puede ser el pase de una visita o el código
 * de una encomienda: el sistema decide cuál es. Un dato menos que recordar
 * en el peor momento del día.
 *
 * La cámara es el camino rápido, pero no se puede depender de ella —tablets
 * sin permiso, sin cámara trasera, visitantes con la pantalla quebrada—, así
 * que el campo de código de seis dígitos está siempre a la vista y no
 * escondido detrás de un "¿problemas?".
 *
 * Para leer el QR se usa el detector nativo del navegador cuando existe
 * (`BarcodeDetector`) y `jsqr` en el resto: Chrome de escritorio en Windows,
 * que es donde suele estar la tablet de portería, no trae el nativo.
 */

interface Props {
  open: boolean;
  onClose: () => void;
  onRegistered: (item: ActivityItem) => void;
}

const DRAWER: React.CSSProperties = {
  position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50,
  background: "var(--px-bone)", borderRadius: "24px 24px 0 0",
  padding: "0 clamp(16px, 5vw, 28px) calc(36px + env(safe-area-inset-bottom, 0px))", maxHeight: "88dvh",
  display: "flex", flexDirection: "column",
};

const MONO: React.CSSProperties = {
  fontFamily: "var(--font-jetbrains-mono)",
  fontSize: 10, letterSpacing: "0.08em", color: "var(--px-mid)",
};

type EstadoCamara = "iniciando" | "activa" | "sin_permiso" | "sin_camara" | "sin_respuesta";

function hora(iso: string) {
  return new Date(iso).toLocaleTimeString("es-CL", { timeZone: "America/Santiago",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
}

function fechaCorta(iso: string) {
  const d = new Date(iso);
  const hoy = new Date();
  const mismo = d.toDateString() === hoy.toDateString();
  return mismo
    ? `hoy ${hora(iso)}`
    : `${d.toLocaleDateString("es-CL", { timeZone: "America/Santiago", day: "numeric", month: "short" })} ${hora(iso)}`;
}

export default function QrScanDrawer({ open, onClose, onRegistered }: Props) {
  const [codigo, setCodigo] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scan, setScan] = useState<ScanResult | null>(null);
  /** El texto tal cual salió del QR: se manda al servidor para que compruebe. */
  const [crudo, setCrudo] = useState("");
  const [quienRetira, setQuienRetira] = useState("");
  const [registrando, setRegistrando] = useState(false);
  const [listo, setListo] = useState<null | { titulo: string; detalle: string }>(null);
  const [camara, setCamara] = useState<EstadoCamara>("iniciando");

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // Evita que un QR que sigue frente a la cámara dispare diez consultas.
  const buscandoRef = useRef(false);

  useResetOnOpen(open, () => {
    setCodigo("");
    setBuscando(false);
    setError(null);
    setScan(null);
    setCrudo("");
    setQuienRetira("");
    setRegistrando(false);
    setListo(null);
    setCamara("iniciando");
    buscandoRef.current = false;
  });

  const buscar = useCallback(async (entrada: string) => {
    if (buscandoRef.current) return;
    buscandoRef.current = true;
    setBuscando(true);
    setError(null);

    const res = await lookupScan(entrada);
    setBuscando(false);

    if (!res.ok) {
      setError(res.error ?? "No se encontró nada con eso");
      buscandoRef.current = false;
      return;
    }

    // Encontrado: el candado se queda puesto para que la cámara no siga
    // buscando mientras el conserje mira la tarjeta.
    setCrudo(entrada);
    setScan(res);
    if (res.tipo === "encomienda") {
      setQuienRetira(res.encomienda?.residentName ?? "");
    }
  }, []);

  // ── Cámara ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!open || scan) return;

    let cancelado = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    // Si nadie contesta el permiso, `getUserMedia` no resuelve ni falla: se
    // queda colgado y el conserje mira "encendiendo la cámara" hasta que se
    // aburre. A los seis segundos se le dice qué hacer.
    const espera = setTimeout(() => {
      if (!cancelado) setCamara((estado) => (estado === "iniciando" ? "sin_respuesta" : estado));
    }, 6000);

    async function encender() {
      if (!navigator.mediaDevices?.getUserMedia) {
        if (!cancelado) setCamara("sin_camara");
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (cancelado) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setCamara("activa");

        // Detector nativo si el navegador lo trae; si no, el decodificador
        // en JavaScript. Se resuelve una vez, no en cada cuadro.
        type Detector = { detect: (fuente: CanvasImageSource) => Promise<{ rawValue: string }[]> };
        let nativo: Detector | null = null;
        const Nativo = (window as unknown as {
          BarcodeDetector?: new (opciones: { formats: string[] }) => Detector;
        }).BarcodeDetector;
        if (Nativo) {
          try {
            nativo = new Nativo({ formats: ["qr_code"] });
          } catch {
            nativo = null;
          }
        }
        const jsQR = nativo ? null : (await import("jsqr")).default;
        if (cancelado) return;

        // Cuatro lecturas por segundo: suficiente para que se sienta
        // inmediato y no deja la tablet caliente.
        timer = setInterval(async () => {
          const video = videoRef.current;
          const canvas = canvasRef.current;
          if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) return;
          if (buscandoRef.current) return;

          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          if (!ctx) return;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          let leido: string | null = null;
          if (nativo) {
            const codigos = await nativo.detect(canvas).catch(() => []);
            leido = codigos[0]?.rawValue ?? null;
          } else if (jsQR) {
            const imagen = ctx.getImageData(0, 0, canvas.width, canvas.height);
            leido = jsQR(imagen.data, imagen.width, imagen.height)?.data ?? null;
          }

          if (leido) buscar(leido);
        }, 250);
      } catch (err) {
        if (cancelado) return;
        const nombre = (err as { name?: string })?.name;
        setCamara(nombre === "NotAllowedError" ? "sin_permiso" : "sin_camara");
      }
    }

    encender();

    return () => {
      cancelado = true;
      clearTimeout(espera);
      if (timer) clearInterval(timer);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [open, scan, buscar]);

  // ── Acciones ────────────────────────────────────────────────────

  async function registrarVisita() {
    const pase = scan?.pase;
    if (!pase || registrando) return;
    setRegistrando(true);
    setError(null);

    const res = await registerPassEntry(pase.passId);
    setRegistrando(false);

    if (!res.ok) {
      setError(res.error ?? "No se pudo registrar el ingreso");
      return;
    }

    onRegistered({
      id: undefined,
      t: hora(new Date().toISOString()),
      dir: "in",
      who: res.visitorName ?? pase.visitorName,
      ctx: "Visita",
      unit: res.unitCode ?? pase.unitCode,
      plate: pase.plate ?? null,
      by: "",
    });

    setListo({ titulo: "Ingreso registrado", detalle: `${pase.visitorName} · ${pase.unitCode}` });
    setTimeout(onClose, 1800);
  }

  async function entregar() {
    const enc = scan?.encomienda;
    if (!enc || registrando) return;
    if (quienRetira.trim().length < 2) {
      setError("Escribe el nombre de quien retira");
      return;
    }
    setRegistrando(true);
    setError(null);

    const res = await entregarEncomienda({
      parcelId: enc.parcelId,
      pickedUpBy: quienRetira,
      // El servidor vuelve a comprobar las dos cosas: lo que diga el
      // navegador no alcanza para marcar una entrega como verificada.
      scan: enc.fromQr ? crudo : undefined,
      code: enc.fromQr ? undefined : codigo || undefined,
    });
    setRegistrando(false);

    if (!res.ok) {
      setError(res.error ?? "No se pudo registrar la entrega");
      return;
    }

    onRegistered({
      id: undefined,
      t: hora(new Date().toISOString()),
      dir: "out",
      who: quienRetira.trim(),
      ctx: "Encomienda retirada",
      unit: enc.unitCode ?? "",
      plate: null,
      by: "",
    });

    setListo({
      titulo: "Encomienda entregada",
      detalle: `${quienRetira.trim()}${enc.unitCode ? ` · ${enc.unitCode}` : ""}`,
    });
    setTimeout(onClose, 1800);
  }

  function volverAEscanear() {
    setScan(null);
    setCrudo("");
    setError(null);
    setCodigo("");
    setQuienRetira("");
    buscandoRef.current = false;
  }

  const pase = scan?.pase;
  const encomienda = scan?.encomienda;

  return (
    <>
      <div style={{ position: "fixed", inset: 0, background: "rgba(20,15,8,0.45)", zIndex: 40, opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none", transition: "opacity 0.2s" }} />
      <div {...atributosDeCajon(open, "Escanear pase")} style={{ ...DRAWER, transform: open ? "translateY(0)" : "translateY(100%)", transition: "transform 0.28s cubic-bezier(0.32, 0.72, 0, 1)", boxShadow: "0 -4px 40px -8px rgba(20,15,8,0.25)" }}>

        <div style={{ position: "absolute", top: 10, left: "50%", transform: "translateX(-50%)", width: 40, height: 4, borderRadius: 2, background: "var(--px-line)" }} />

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 22, paddingBottom: 18, flexShrink: 0 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em" }}>
              {listo ? "" : pase ? "Pase encontrado" : encomienda ? "Encomienda encontrada" : "Escanear"}
            </h2>
            {!scan && !listo && (
              <div style={{ fontSize: 13.5, color: "var(--px-mid)", marginTop: 3 }}>
                Pase de visita o encomienda · apunta al QR o digita el código
              </div>
            )}
          </div>
          <BotonCerrar onClick={onClose} />
        </div>

        <div style={{ flex: 1, minHeight: 0, overflow: "auto", paddingBottom: 8 }}>

          {/* ── Listo ─────────────────────────────────────────────── */}
          {listo ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, textAlign: "center", padding: "30px 0 40px" }}>
              <div style={{ width: 64, height: 64, borderRadius: 32, background: "var(--px-ok)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg viewBox="0 0 24 24" width={28} height={28} fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em" }}>{listo.titulo}</div>
                <div style={{ fontSize: 14.5, color: "var(--px-mid)", marginTop: 4 }}>{listo.detalle}</div>
              </div>
            </div>

          /* ── Pase de visita ────────────────────────────────────── */
          ) : pase ? (
            <div>
              <div style={{ background: "oklch(0.95 0.05 150)", border: "1px solid var(--px-ok)", borderRadius: 16, padding: "20px 22px" }}>
                <div style={{ ...MONO, color: "oklch(0.42 0.12 150)" }}>
                  ANUNCIADA POR {(pase.authorizedBy ?? "LA UNIDAD").toUpperCase()}
                </div>
                <div style={{ fontSize: 30, fontWeight: 600, letterSpacing: "-0.03em", marginTop: 6 }}>
                  {pase.visitorName}
                </div>
                <div style={{ fontSize: 16, color: "var(--px-ink2)", marginTop: 4 }}>
                  {pase.unitCode} · {pase.residentName}
                </div>
                <div style={{ ...MONO, marginTop: 10 }}>
                  {pase.visitorRut ? `RUT ${formatRut(pase.visitorRut)} · ` : ""}
                  {pase.plate ? `PATENTE ${pase.plate} · ` : ""}
                  VÁLIDO HASTA {hora(pase.validUntil)}
                </div>
                {pase.note && (
                  <div style={{ fontSize: 14, color: "var(--px-ink2)", marginTop: 10, fontStyle: "italic" }}>
                    “{pase.note}”
                  </div>
                )}
              </div>

              {error && <Aviso texto={error} />}

              <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                <BotonSecundario onClick={volverAEscanear}>No es él</BotonSecundario>
                <button
                  onClick={registrarVisita}
                  disabled={registrando}
                  style={{ flex: 2, padding: "16px", background: "var(--px-ok)", color: "white", border: "none", borderRadius: 12, font: "inherit", fontSize: 17, fontWeight: 600, cursor: registrando ? "default" : "pointer" }}
                >
                  {registrando ? "Registrando…" : "Registrar ingreso"}
                </button>
              </div>
            </div>

          /* ── Encomienda ────────────────────────────────────────── */
          ) : encomienda ? (
            <div>
              <div style={{ background: "oklch(0.96 0.04 250)", border: "1px solid oklch(0.70 0.12 250)", borderRadius: 16, padding: "20px 22px" }}>
                <div style={{ ...MONO, color: "oklch(0.42 0.14 250)" }}>
                  ENCOMIENDA · {encomienda.fromQr ? "QR VERIFICADO" : "CÓDIGO VERIFICADO"}
                </div>
                <div style={{ fontSize: 30, fontWeight: 600, letterSpacing: "-0.03em", marginTop: 6 }}>
                  {encomienda.unitCode ?? "Sin depto"}
                </div>
                <div style={{ fontSize: 16, color: "var(--px-ink2)", marginTop: 4 }}>
                  {encomienda.residentName ?? "Sin residente asignado"}
                  {encomienda.courier ? ` · ${encomienda.courier}` : ""}
                </div>
                <div style={{ ...MONO, marginTop: 10 }}>
                  RECIBIDA {fechaCorta(encomienda.receivedAt).toUpperCase()}
                </div>
              </div>

              <div style={{ ...MONO, margin: "16px 0 8px" }}>¿QUIÉN SE LA LLEVA?</div>
              <input aria-label="Nombre de quien retira"
                value={quienRetira}
                onChange={(e) => { setQuienRetira(e.target.value); setError(null); }}
                onKeyDown={(e) => { if (e.key === "Enter") entregar(); }}
                placeholder="Nombre de quien retira"
                style={{
                  width: "100%", padding: "14px 18px", fontSize: 17,
                  fontFamily: "var(--font-inter-tight), Inter, system-ui, sans-serif",
                  background: "white", border: "1px solid var(--px-line)",
                  borderRadius: 12, outline: "none", color: "var(--px-ink)",
                }}
              />

              {error && <Aviso texto={error} />}

              <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                <BotonSecundario onClick={volverAEscanear}>Cancelar</BotonSecundario>
                <button
                  onClick={entregar}
                  disabled={registrando}
                  style={{ flex: 2, padding: "16px", background: "var(--px-ok)", color: "white", border: "none", borderRadius: 12, font: "inherit", fontSize: 17, fontWeight: 600, cursor: registrando ? "default" : "pointer" }}
                >
                  {registrando ? "Registrando…" : "Entregar encomienda"}
                </button>
              </div>
            </div>

          /* ── Escaneo ───────────────────────────────────────────── */
          ) : (
            <div className="px-grid" style={{ "--cols": "1fr 320px", "--gap": "24px", alignItems: "start" } as CSSProperties}>
              <div>
                <div style={{ ...MONO, marginBottom: 8 }}>CÁMARA</div>
                <div
                  style={{
                    position: "relative", width: "100%", aspectRatio: "4 / 3",
                    background: "var(--px-ink)", borderRadius: 16, overflow: "hidden",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    style={{
                      width: "100%", height: "100%", objectFit: "cover",
                      display: camara === "activa" ? "block" : "none",
                    }}
                  />
                  {camara === "activa" && (
                    <div
                      style={{
                        position: "absolute", inset: "18%",
                        border: "3px solid rgba(255,255,255,0.85)", borderRadius: 16,
                        pointerEvents: "none",
                      }}
                    />
                  )}
                  {camara !== "activa" && (
                    <div style={{ color: "var(--px-bone)", fontSize: 14, textAlign: "center", padding: 24, lineHeight: 1.5 }}>
                      {camara === "iniciando"
                        ? "Encendiendo la cámara…"
                        : camara === "sin_respuesta"
                        ? "La cámara no responde. Puede estar esperando que le des permiso en el navegador — mientras tanto, pide el código de 6 dígitos."
                        : camara === "sin_permiso"
                        ? "Esta tablet no tiene permiso para usar la cámara. Dáselo en el navegador, o pide el código de 6 dígitos."
                        : "Esta tablet no tiene cámara disponible. Pide el código de 6 dígitos."}
                    </div>
                  )}
                </div>
                <canvas ref={canvasRef} style={{ display: "none" }} />
              </div>

              <div>
                <div style={{ ...MONO, marginBottom: 8 }}>O EL CÓDIGO DE 6 DÍGITOS</div>
                <input aria-label="Código de 6 dígitos"
                  value={codigo}
                  onChange={(e) => { setCodigo(e.target.value.replace(/[^0-9]/g, "").slice(0, 6)); setError(null); }}
                  onKeyDown={(e) => { if (e.key === "Enter" && codigo.length === 6) buscar(codigo); }}
                  placeholder="482913"
                  inputMode="numeric"
                  maxLength={6}
                  style={{
                    width: "100%", padding: "18px 22px",
                    fontFamily: "var(--font-jetbrains-mono)", fontSize: 30,
                    letterSpacing: "0.14em", textAlign: "center",
                    background: "white", border: "1px solid var(--px-line)",
                    borderRadius: 14, outline: "none", color: "var(--px-ink)",
                  }}
                />
                <button
                  onClick={() => buscar(codigo)}
                  disabled={codigo.length !== 6 || buscando}
                  style={{
                    width: "100%", marginTop: 12, padding: "16px",
                    background: codigo.length === 6 ? "var(--px-ink)" : "var(--px-line)",
                    color: "var(--px-bone)", border: "none", borderRadius: 14,
                    font: "inherit", fontSize: 16, fontWeight: 600,
                    cursor: codigo.length === 6 ? "pointer" : "not-allowed",
                  }}
                >
                  {buscando ? "Buscando…" : "Buscar"}
                </button>

                {error && <Aviso texto={error} />}

                <div style={{ fontSize: 12.5, color: "var(--px-mid)", marginTop: 14, lineHeight: 1.55 }}>
                  Sirve para el pase de una visita y para el código de una encomienda.
                  Si no traen ninguno, entrega el paquete desde <strong>Encomiendas</strong> y
                  registra la visita por <strong>Visita</strong>.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function Aviso({ texto }: { texto: string }) {
  return (
    <div style={{ marginTop: 12, padding: "11px 14px", borderRadius: 10, background: "oklch(0.96 0.05 28)", border: "1px solid oklch(0.88 0.12 28)", color: "var(--px-alert)", fontSize: 14, lineHeight: 1.5 }}>
      {texto}
    </div>
  );
}

function BotonSecundario({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{ flex: 1, padding: "16px", background: "white", border: "1px solid var(--px-line)", borderRadius: 12, font: "inherit", fontSize: 15, fontWeight: 500, color: "var(--px-ink2)", cursor: "pointer" }}
    >
      {children}
    </button>
  );
}

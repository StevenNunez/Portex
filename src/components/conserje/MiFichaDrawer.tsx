"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { guardarMiFicha, verMiFicha } from "@/app/actions";

/**
 * Los datos del propio trabajador, mantenidos por él.
 *
 * El administrador no puede andar persiguiendo a diez conserjes para saber si
 * cambiaron de teléfono, y menos para conseguir a quién llamar si alguien se
 * accidenta en un turno de noche. El que sabe esos datos es cada uno.
 *
 * Lo que **no** se puede tocar acá: el nombre, el RUT y el rol. Eso es
 * identidad laboral y la mantiene quien administra — si un conserje pudiera
 * cambiarse el rol, la asistencia y los turnos dejarían de significar algo.
 * Por eso salen a la vista pero en gris.
 */

const CAMPO: CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  fontSize: 16,
  fontFamily: "var(--font-inter-tight), Inter, system-ui, sans-serif",
  border: "1px solid var(--px-line)",
  borderRadius: 10,
  outline: "none",
  background: "white",
  color: "var(--px-ink)",
};

const ETIQUETA: CSSProperties = {
  display: "block",
  fontSize: 13,
  fontWeight: 500,
  marginBottom: 6,
  color: "var(--px-ink2)",
};

interface Ficha {
  id: string;
  name: string;
  role: string;
  contact: string | null;
  email: string | null;
  emergencyName: string | null;
  emergencyPhone: string | null;
}

export default function MiFichaDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();

  const [ficha, setFicha] = useState<Ficha | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [contact, setContact] = useState("");
  const [emerNombre, setEmerNombre] = useState("");
  const [emerFono, setEmerFono] = useState("");

  // Reaccionar a que el cajón se abrió es un cambio de prop, no una
  // sincronización con nada de afuera: se ajusta **durante el render**. Poner
  // estos `setState` dentro del efecto obliga a pintar dos veces y Next 16 lo
  // marca como error (`react-hooks/set-state-in-effect`).
  const [abiertoPrevio, setAbiertoPrevio] = useState(open);
  if (abiertoPrevio !== open) {
    setAbiertoPrevio(open);
    if (open) {
      setCargando(true);
      setGuardado(false);
    }
  }

  // El efecto queda solo para lo que sí es de afuera: pedirle la ficha al
  // servidor. Ahí el `setState` va en el callback, que es el patrón correcto.
  useEffect(() => {
    if (!open) return;
    let vivo = true;

    verMiFicha()
      .then((f) => {
        if (!vivo) return;
        setFicha(f);
        setContact(f?.contact ?? "");
        setEmerNombre(f?.emergencyName ?? "");
        setEmerFono(f?.emergencyPhone ?? "");
        setCargando(false);
      })
      .catch(() => vivo && setCargando(false));

    return () => { vivo = false; };
  }, [open]);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (guardando) return;
    setGuardando(true);
    setError(null);

    const res = await guardarMiFicha({
      contact,
      emergencyName: emerNombre,
      emergencyPhone: emerFono,
    });

    if (!res.ok) {
      setError(res.error ?? "No se pudo guardar");
      setGuardando(false);
      return;
    }
    setGuardado(true);
    setGuardando(false);
    router.refresh();
  }

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 40,
          background: "rgba(20,15,8,0.45)",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition: "opacity 0.2s",
        }}
      />

      <div
        style={{
          position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50,
          background: "var(--px-bone)",
          borderRadius: "22px 22px 0 0",
          padding: "0 clamp(16px, 5vw, 28px) calc(32px + env(safe-area-inset-bottom, 0px))",
          maxHeight: "88dvh",
          transform: open ? "translateY(0)" : "translateY(100%)",
          transition: "transform 0.26s cubic-bezier(0.4,0,0.2,1)",
          display: "flex", flexDirection: "column",
          boxShadow: "0 -8px 40px rgba(0,0,0,0.14)",
        }}
      >
        <div style={{ padding: "22px 0 16px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexShrink: 0 }}>
          <div>
            <div style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 10.5, letterSpacing: "0.08em", color: "var(--px-mid)" }}>
              MIS DATOS
            </div>
            <div style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.025em", marginTop: 3 }}>
              {ficha?.name ?? "Mi ficha"}
            </div>
            {ficha && (
              <div style={{ fontSize: 14, color: "var(--px-mid)", marginTop: 2 }}>
                {ficha.role}
                {ficha.email ? ` · ${ficha.email}` : ""}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            style={{
              background: "none", border: "none", cursor: "pointer", color: "var(--px-mid)",
              padding: 8, borderRadius: 8, flexShrink: 0,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M3 3l10 10M13 3L3 13" />
            </svg>
          </button>
        </div>

        <div style={{ flex: 1, overflow: "auto", paddingBottom: 8 }}>
          {cargando ? (
            <div style={{ padding: "30px 0", color: "var(--px-mid)", fontSize: 14 }}>
              Buscando tu ficha…
            </div>
          ) : !ficha ? (
            <div style={{ padding: "20px 0", fontSize: 14, color: "var(--px-mid)", lineHeight: 1.6, maxWidth: 460 }}>
              Tu cuenta todavía no está ligada a una ficha de personal. Pídele al
              administrador que te agregue desde <strong style={{ color: "var(--px-ink2)" }}>Personal</strong>,
              con el mismo correo con el que entras.
            </div>
          ) : (
            <form onSubmit={guardar} style={{ maxWidth: 460 }}>
              <p style={{ margin: "0 0 20px", fontSize: 13.5, color: "var(--px-mid)", lineHeight: 1.6 }}>
                Manténlos al día: es lo que la administración usa para ubicarte, y para
                saber a quién avisar si algo pasa durante tu turno.
              </p>

              <div style={{ marginBottom: 18 }}>
                <label style={ETIQUETA} htmlFor="mi-fono">Mi teléfono</label>
                <input
                  id="mi-fono"
                  type="tel"
                  value={contact}
                  onChange={(e) => { setContact(e.target.value); setGuardado(false); }}
                  placeholder="+56 9 1234 5678"
                  style={CAMPO}
                />
              </div>

              <div style={{ marginBottom: 18 }}>
                <label style={ETIQUETA} htmlFor="emer-nombre">
                  Contacto de emergencia{" "}
                  <span style={{ fontWeight: 400, color: "var(--px-mid)" }}>— quién es</span>
                </label>
                <input
                  id="emer-nombre"
                  value={emerNombre}
                  onChange={(e) => { setEmerNombre(e.target.value); setGuardado(false); }}
                  placeholder="Ej: Rosa Muñoz, mi hermana"
                  style={CAMPO}
                />
              </div>

              <div style={{ marginBottom: 22 }}>
                <label style={ETIQUETA} htmlFor="emer-fono">Su teléfono</label>
                <input
                  id="emer-fono"
                  type="tel"
                  value={emerFono}
                  onChange={(e) => { setEmerFono(e.target.value); setGuardado(false); }}
                  placeholder="+56 9 8765 4321"
                  style={CAMPO}
                />
              </div>

              {error && (
                <div
                  style={{
                    background: "oklch(0.96 0.05 28)", border: "1px solid oklch(0.88 0.12 28)",
                    borderRadius: 10, padding: "11px 15px", marginBottom: 16,
                    fontSize: 14, color: "oklch(0.40 0.18 28)",
                  }}
                >
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={guardando}
                style={{
                  width: "100%", padding: "14px",
                  background: guardado ? "var(--px-ok)" : "var(--px-ink)",
                  color: "white", border: "none", borderRadius: 12,
                  font: "inherit", fontSize: 16, fontWeight: 600,
                  cursor: guardando ? "default" : "pointer",
                  opacity: guardando ? 0.6 : 1,
                }}
              >
                {guardando ? "Guardando…" : guardado ? "✓ Guardado" : "Guardar mis datos"}
              </button>

              <p style={{ margin: "14px 0 0", fontSize: 12.5, color: "var(--px-mid2)", lineHeight: 1.6 }}>
                Tu nombre, tu RUT y tu rol los mantiene la administración: son los que
                identifican tus turnos y tu asistencia.
              </p>
            </form>
          )}
        </div>
      </div>
    </>
  );
}

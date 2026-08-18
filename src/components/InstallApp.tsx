"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { IconMark } from "@/components/icons";

/**
 * "Instálala en tu teléfono".
 *
 * Portex no está en las tiendas: es una PWA, así que se instala desde el
 * navegador. El problema es que nadie sabe que eso existe — la gente busca
 * la app en el App Store, no la encuentra y se va. Este aviso lo dice.
 *
 * Chrome y Android avisan al navegador que la app se puede instalar
 * (`beforeinstallprompt`) y ahí el botón hace todo. Safari en iPhone no
 * tiene ese evento y nunca lo tuvo, así que a esos se les explica el gesto
 * exacto: Compartir → Agregar a inicio. Es el mismo mensaje, dicho como
 * cada teléfono lo entiende.
 *
 * Aparece a los tres segundos —no encima del titular—, y si lo cierran no
 * vuelve: nada más molesto que un cartel que insiste.
 */

const CERRADO = "portex.instalar.cerrado";

interface PromptDeInstalacion extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * Qué navegador es esto y si ya tomó una decisión.
 *
 * Son lecturas del navegador, no estado de la app: por eso salen de
 * `useSyncExternalStore` y no de un efecto que llame a `setState` — eso
 * obliga a pintar dos veces y el aviso alcanza a parpadear.
 */
const sinSuscripcion = () => () => {};

/** Qué tiene que decir el aviso, según lo que sepa hacer este navegador. */
type Estado = "oculto" | "instalable" | "ios";

function esIphone(): boolean {
  const ua = window.navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua);
  const safari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
  return ios && safari;
}

declare global {
  interface Window {
    __portexInstalar: PromptDeInstalacion | null;
  }
}

/** La invitación que guardó el script del layout, si Chrome la ofreció. */
function suscribirInstalable(alCambiar: () => void) {
  window.addEventListener("portex:instalable", alCambiar);
  return () => window.removeEventListener("portex:instalable", alCambiar);
}

function leerInstalable(): PromptDeInstalacion | null {
  return window.__portexInstalar ?? null;
}

function yaResuelto(): boolean {
  const instalada =
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as { standalone?: boolean }).standalone === true;
  return instalada || localStorage.getItem(CERRADO) === "1";
}

export default function InstallApp() {
  // En el servidor no hay navegador que preguntar: el aviso nace apagado y
  // aparece solo si el navegador dice que se puede instalar.
  const iphone = useSyncExternalStore(sinSuscripcion, esIphone, () => false);
  const resuelto = useSyncExternalStore(sinSuscripcion, yaResuelto, () => true);

  const evento = useSyncExternalStore(suscribirInstalable, leerInstalable, () => null);
  const [visible, setVisible] = useState(false);
  const [cerrado, setCerrado] = useState(false);

  useEffect(() => {
    if (resuelto) return;

    // Sin service worker registrado, el navegador no ofrece instalar nada.
    // Registrarlo acá lo deja listo desde la primera visita, antes incluso
    // de que la persona tenga cuenta.
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    // Tres segundos: que primero lea el titular, no que le tape la entrada.
    const id = setTimeout(() => setVisible(true), 3000);
    return () => clearTimeout(id);
  }, [resuelto]);

  async function instalar() {
    if (!evento) return;
    await evento.prompt();
    const { outcome } = await evento.userChoice;
    if (outcome === "accepted") cerrar();
  }

  function cerrar() {
    localStorage.setItem(CERRADO, "1");
    setCerrado(true);
  }

  const estado: Estado = evento ? "instalable" : iphone ? "ios" : "oculto";

  if (resuelto || cerrado || !visible || estado === "oculto") return null;

  return (
    <div
      style={{
        position: "fixed",
        left: 16,
        right: 16,
        bottom: 16,
        zIndex: 90,
        display: "flex",
        justifyContent: "center",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          pointerEvents: "auto",
          display: "flex",
          alignItems: "center",
          gap: 16,
          maxWidth: 520,
          width: "100%",
          padding: "14px 16px",
          background: "rgba(18,17,15,0.94)",
          border: "1px solid rgba(255,255,255,0.14)",
          borderRadius: 16,
          backdropFilter: "blur(20px)",
          boxShadow: "0 18px 50px -12px rgba(0,0,0,0.8)",
          animation: "portex-subir 0.35s cubic-bezier(0.32,0.72,0,1)",
        }}
      >
        <style>{`@keyframes portex-subir { from { opacity: 0; transform: translateY(14px) } to { opacity: 1; transform: none } }`}</style>

        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: 11,
            background: "#080808",
            border: "1px solid rgba(255,255,255,0.12)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            color: "#F9F7F4",
          }}
        >
          <IconMark size={24} accent="#FF3B3B" />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontWeight: 600, color: "#F9F7F4", letterSpacing: "-0.02em" }}>
            Tenla en el teléfono
          </div>
          <div style={{ fontSize: 12.5, color: "#8B867F", lineHeight: 1.45, marginTop: 2 }}>
            {estado === "ios" ? (
              <>
                Toca <strong style={{ color: "#C9C4BC" }}>Compartir</strong> y luego{" "}
                <strong style={{ color: "#C9C4BC" }}>Agregar a inicio</strong>. Así suena cuando
                alguien llega a buscarte.
              </>
            ) : (
              <>Se instala como app y te avisa cuando alguien llega a buscarte.</>
            )}
          </div>
        </div>

        {estado === "instalable" && (
          <button
            onClick={instalar}
            style={{
              flexShrink: 0,
              padding: "10px 16px",
              background: "#F9F7F4",
              color: "#080808",
              border: "none",
              borderRadius: 10,
              font: "inherit",
              fontSize: 13.5,
              fontWeight: 600,
              letterSpacing: "-0.01em",
              cursor: "pointer",
            }}
          >
            Instalar
          </button>
        )}

        <button
          onClick={cerrar}
          aria-label="Cerrar"
          style={{
            flexShrink: 0,
            width: 28,
            height: 28,
            background: "transparent",
            border: "none",
            color: "#6b6660",
            fontSize: 17,
            cursor: "pointer",
            lineHeight: 1,
          }}
        >
          ×
        </button>
      </div>
    </div>
  );
}

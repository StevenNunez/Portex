"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import {
  activarPush,
  getPushPermission,
  subscribePushPermission,
} from "@/lib/push-navegador";

/**
 * Los avisos de la portería.
 *
 * El conserje casi nunca está mirando la pantalla: está en la puerta, firmando
 * una encomienda, atendiendo al del gas. Sin aviso, una solicitud de acceso
 * puede quedarse ahí toda la tarde y el vecino queda pensando que la app no
 * sirve.
 *
 * Lo que decide si hay que hacer algo **no es el permiso, es la suscripción**.
 * Son cosas distintas y se separan seguido: el permiso quedó concedido en ese
 * navegador desde otra pantalla de Portex, o el navegador dio de baja la
 * suscripción por su cuenta —lo hace—, o se limpiaron los datos del sitio y el
 * permiso sobrevivió. En todos esos casos `Notification.permission` dice
 * "granted" y no llega ni un aviso. Mirando solo el permiso, la portería se
 * quedaba muda sin que nadie pudiera notarlo.
 *
 * Por eso, si el permiso ya está dado pero no hay suscripción, se vuelve a
 * suscribir sola y en silencio: no hay nada que preguntarle a nadie, el
 * consentimiento ya está y una portería que se queda sin avisos a mitad del
 * turno no se arregla con un botón que nadie mira.
 */
export default function AvisosPorteria({ vapidPublicKey }: { vapidPublicKey: string }) {
  const permiso = useSyncExternalStore(
    subscribePushPermission,
    getPushPermission,
    () => "desconocido" as const
  );

  // null mientras se averigua: sin esto el botón parpadea en cada carga.
  const [suscrito, setSuscrito] = useState<boolean | null>(null);
  const [activando, setActivando] = useState(false);

  useEffect(() => {
    let vivo = true;

    (async () => {
      if (!vapidPublicKey || !("serviceWorker" in navigator) || !("PushManager" in window)) {
        if (vivo) setSuscrito(true); // no hay nada que ofrecer
        return;
      }

      try {
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = reg ? await reg.pushManager.getSubscription() : null;

        if (sub) {
          if (vivo) setSuscrito(true);
          return;
        }

        // Permiso dado y sin suscripción: se repara sola, sin preguntar.
        if (Notification.permission === "granted") {
          const ok = await activarPush(vapidPublicKey);
          if (vivo) setSuscrito(ok);
          return;
        }

        if (vivo) setSuscrito(false);
      } catch {
        if (vivo) setSuscrito(false);
      }
    })();

    return () => { vivo = false; };
  }, [vapidPublicKey]);

  if (!vapidPublicKey) return null;
  if (suscrito === null || suscrito) return null;
  if (permiso === "no-soportado") return null;

  // Bloqueado desde el navegador: el botón no puede volver a preguntar, así
  // que en vez de un botón muerto se dice dónde se arregla.
  if (permiso === "denied") {
    return (
      <span
        title="Los avisos están bloqueados para este sitio. Se reactivan desde el candado de la barra de direcciones."
        style={{
          fontFamily: "var(--font-jetbrains-mono)", fontSize: 11,
          color: "var(--px-mid)", padding: "6px 10px", borderRadius: 999,
          border: "1px solid var(--px-line)", whiteSpace: "nowrap",
        }}
      >
        AVISOS BLOQUEADOS
      </span>
    );
  }

  async function encender() {
    setActivando(true);
    const ok = await activarPush(vapidPublicKey);
    setSuscrito(ok);
    setActivando(false);
  }

  return (
    <button
      onClick={encender}
      disabled={activando}
      title="Recibe un aviso cuando un vecino pide acceso a la app, aunque no estés mirando la pantalla"
      style={{
        display: "flex", alignItems: "center", gap: 6,
        padding: "6px 12px", borderRadius: 999,
        background: "white", border: "1px solid var(--px-line)",
        fontFamily: "var(--font-jetbrains-mono)", fontSize: 11,
        letterSpacing: "0.04em", color: "var(--px-ink2)",
        cursor: activando ? "default" : "pointer", whiteSpace: "nowrap",
      }}
    >
      <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4">
        <path d="M3.2 6a3.8 3.8 0 0 1 7.6 0c0 3 1 3.8 1 3.8H2.2S3.2 9 3.2 6z" />
        <path d="M5.8 11.6a1.4 1.4 0 0 0 2.4 0" />
      </svg>
      {activando ? "ACTIVANDO…" : "ACTIVAR AVISOS"}
    </button>
  );
}

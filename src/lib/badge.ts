/**
 * El punto rojo del ícono.
 *
 * Es lo que hace que el residente sepa que pasa algo sin abrir nada, igual
 * que cualquier app del teléfono. Vale sobre todo cuando la notificación se
 * fue de la barra —se deslizó sin querer, o el teléfono estaba en el bolsillo
 * y se limpió sola—: el punto se queda hasta que efectivamente se atienda.
 *
 * Solo funciona con la app **instalada** (en el escritorio o en la pantalla
 * de inicio). En una pestaña del navegador no hay ícono que marcar, así que
 * la llamada simplemente no hace nada — y por eso todo va envuelto: en los
 * navegadores que no la tienen, `setAppBadge` ni siquiera existe.
 */

type ConBadge = Navigator & {
  setAppBadge?: (contents?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

/**
 * Marca el ícono. Con número si se sabe cuántos son; sin número queda el
 * punto a secas, que es lo que muestran algunas plataformas igual.
 */
export function marcarBadge(cuantos?: number) {
  if (typeof navigator === "undefined") return;
  const nav = navigator as ConBadge;
  if (!nav.setAppBadge) return;

  // Un cero no es "cero pendientes", es un punto sin sentido: se limpia.
  if (cuantos === 0) {
    limpiarBadge();
    return;
  }

  nav.setAppBadge(cuantos).catch(() => {});
}

/** Saca el punto. Se llama cuando ya no queda nada esperando. */
export function limpiarBadge() {
  if (typeof navigator === "undefined") return;
  const nav = navigator as ConBadge;
  if (!nav.clearAppBadge) return;
  nav.clearAppBadge().catch(() => {});
}

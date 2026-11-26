"use client";

import { useEffect, useState, type RefObject } from "react";

/**
 * Hooks compartidos por los drawers de portería.
 *
 * Todos hacen lo mismo al abrirse: dejar el formulario en blanco y poner el
 * cursor en el primer campo. Eso se hacía dentro de un `useEffect`, que es el
 * lugar equivocado: React lo permite pero obliga a pintar dos veces (una con
 * los datos viejos y otra con el formulario limpio), y en una tablet lenta el
 * conserje alcanza a ver el nombre de la visita anterior.
 *
 * El reset ahora ocurre **durante el render** —el patrón que React recomienda
 * para ajustar estado cuando cambia una prop— y el foco, que sí es un efecto
 * sobre el DOM, se queda en su propio efecto.
 */

/**
 * Ejecuta `reset()` en el render en que el drawer pasa de cerrado a abierto.
 *
 * `token` sirve para los drawers que se reutilizan para más de una cosa —el de
 * Entrega y Proveedor es el mismo componente—: si cambia estando abierto, el
 * formulario también se limpia.
 */
export function useResetOnOpen(open: boolean, reset: () => void, token = "") {
  const key = open ? `abierto:${token}` : "cerrado";
  const [prevKey, setPrevKey] = useState(key);

  if (key !== prevKey) {
    setPrevKey(key);
    if (open) reset();
  }
}

/**
 * Pone el cursor en el campo indicado al abrir. **Solo con teclado físico.**
 *
 * En la portería de escritorio el foco automático ahorra un clic por registro,
 * y con cien registros al día eso se nota. En una tablet o un teléfono hace
 * justo lo contrario: al abrir el cajón sube el teclado, la hoja —que mide en
 * `dvh`— se encoge, y los botones que están **arriba** del campo (Rappi,
 * Pedidos Ya, Chilexpress…) quedan fuera de la pantalla. El conserje ve el
 * cajón "bajarse" y no alcanza a tocar la plataforma que quería.
 *
 * `pointer: fine` distingue exactamente eso: mouse o lápiz sí, dedo no. Es el
 * mismo criterio que usa `:hover` en los tiles de la portería.
 *
 * Los 80 ms son para que el drawer termine de entrar: si se enfoca antes, el
 * navegador cancela la animación al hacer scroll hacia el input.
 */
export function useFocusOnOpen(open: boolean, ref: RefObject<HTMLInputElement | null>) {
  useEffect(() => {
    if (!open) return;
    if (typeof window !== "undefined" && !window.matchMedia("(pointer: fine)").matches) return;

    const id = setTimeout(() => ref.current?.focus(), 80);
    return () => clearTimeout(id);
  }, [open, ref]);
}

/**
 * Lo que un cajón le dice al lector de pantalla y al teclado.
 *
 * Abierto, es un diálogo con nombre. Cerrado, queda `inert`: los cajones
 * cerrados siguen en la página (solo se esconden bajo el borde), y sin esto
 * el Tab del teclado caía en campos invisibles de cajones que nadie abrió.
 *
 *   <div {...atributosDeCajon(open, "Visita")} style={…}>
 */
export function atributosDeCajon(open: boolean, titulo: string) {
  return {
    role: "dialog" as const,
    "aria-modal": open,
    "aria-label": titulo,
    inert: !open,
  };
}

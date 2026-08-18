"use client";

import { useSyncExternalStore } from "react";

const DAYS = ["DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"];
const MONTHS = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];

function formatClock(d: Date) {
  const day = DAYS[d.getDay()];
  const date = String(d.getDate()).padStart(2, "0");
  const month = MONTHS[d.getMonth()];
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${day} ${date}/${month} · ${hh}:${mm}`;
}

/** El reloj del sistema no es estado de React: se le suscribe. */
function subscribe(onChange: () => void) {
  const id = setInterval(onChange, 10_000);
  return () => clearInterval(id);
}

// Devuelve el mismo string mientras no cambie el minuto, así que React lo ve
// estable y no re-renderiza de más.
const getSnapshot = () => formatClock(new Date());

// En el servidor no hay hora que mostrar: la portería la pinta al hidratar.
const getServerSnapshot = () => "";

export default function LiveClock() {
  const label = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return (
    <span
      style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 12, color: "var(--px-mid)" }}
    >
      {label}
    </span>
  );
}

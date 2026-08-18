"use client";

import { useState } from "react";
import type { ActivityRow } from "@/lib/db";
import { displayContext } from "@/lib/format";
import { formatRut } from "@/lib/rut";
import { todayInChile } from "@/lib/fecha";

/**
 * Exporta la bitácora a CSV desde el navegador.
 *
 * Dos decisiones que se notan al abrir el archivo:
 *
 * - **Separador `;`** en vez de coma. Excel en configuración regional chilena
 *   usa el punto y coma como separador de listas; con comas mete toda la fila
 *   en la primera columna y el administrador cree que el archivo salió malo.
 * - **BOM UTF-8** al principio. Sin él, Excel abre el archivo en la
 *   codificación del sistema y los apellidos con tilde y las ñ llegan rotos.
 */

const TYPE_LABEL: Record<string, string> = {
  in: "Ingreso",
  out: "Salida",
  parcel: "Encomienda",
  vehicle: "Vehículo",
  delivery: "Delivery",
  provider: "Proveedor",
};

const HEADERS = [
  "Fecha",
  "Hora",
  "Tipo",
  "Nombre",
  "RUT",
  "Unidad",
  "Detalle",
  "Patente",
  "Autorizado por",
  "Registrado por",
] as const;

/** Un campo CSV: comillas dobles siempre, y las internas se duplican. */
function cell(value: string | null | undefined): string {
  if (value == null || value === "") return '""';
  return `"${String(value).replace(/"/g, '""')}"`;
}

function buildCsv(rows: ActivityRow[]): string {
  const lines = [HEADERS.map(cell).join(";")];

  for (const r of rows) {
    const at = new Date(r.recorded_at);
    lines.push(
      [
        cell(at.toLocaleDateString("es-CL")),
        cell(at.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", hour12: false })),
        cell(TYPE_LABEL[r.type] ?? r.type),
        cell(r.who),
        cell(r.rut ? formatRut(r.rut) : null),
        cell(r.unit),
        cell(displayContext(r.context)),
        cell(r.plate),
        cell(r.authorized_by),
        cell(r.recorded_by),
      ].join(";")
    );
  }

  // \r\n: es lo que espera Excel en Windows.
  return lines.join("\r\n");
}

export default function ExportCsvButton({
  rows,
  buildingName,
  days,
}: {
  rows: ActivityRow[];
  buildingName?: string | null;
  days: number;
}) {
  const [done, setDone] = useState(false);

  function download() {
    if (rows.length === 0) return;

    const slug = (buildingName ?? "portex")
      .toLowerCase()
      // NFD separa la tilde de la letra para poder descartarla: "Peñalolén"
      // termina en "penalolen" y no en "pe-alol-n".
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const today = todayInChile();
    const filename = `bitacora-${slug}-${days}dias-${today}.csv`;

    const BOM = String.fromCharCode(0xfeff);
    const blob = new Blob([BOM + buildCsv(rows)], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Sin revocar, el blob queda vivo en memoria hasta recargar la página. Pero
    // revocarlo en el mismo tick alcanza a cancelar la descarga en algunos
    // navegadores, así que se le da margen.
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    setDone(true);
    setTimeout(() => setDone(false), 2500);
  }

  const empty = rows.length === 0;

  return (
    <button
      onClick={download}
      disabled={empty}
      title={empty ? "No hay registros que exportar en este período" : undefined}
      style={{
        background: "white",
        border: "1px solid var(--px-line)",
        borderRadius: 8,
        padding: "9px 14px",
        fontSize: 13,
        fontWeight: 500,
        fontFamily: "var(--font-inter-tight), Inter, system-ui, sans-serif",
        cursor: empty ? "not-allowed" : "pointer",
        color: empty ? "var(--px-mid2)" : done ? "var(--px-ok)" : "var(--px-ink2)",
        opacity: empty ? 0.6 : 1,
        transition: "color 0.2s ease",
        whiteSpace: "nowrap",
      }}
    >
      {done ? "✓ Descargado" : `Exportar CSV · ${rows.length}`}
    </button>
  );
}

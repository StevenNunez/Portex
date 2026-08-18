"use client";

import { useState } from "react";
import { todayInChile } from "@/lib/fecha";

/**
 * Exporta las jornadas a CSV. Mismas dos decisiones que la bitácora: separador
 * `;` y BOM UTF-8, porque el archivo se abre en Excel en configuración chilena.
 *
 * Las horas van además en decimal ("8,25") en su propia columna: es lo que la
 * administradora copia a la planilla de sueldos.
 */

export interface AsistenciaCsvRow {
  date: string;
  name: string;
  role: string;
  rut: string | null;
  checkedIn: string;
  checkedOut: string | null;
  minutos: number | null;
  late: number | null;
  early: number | null;
  note: string | null;
}

const HEADERS = [
  "Fecha",
  "Nombre",
  "RUT",
  "Cargo",
  "Entrada",
  "Salida",
  "Horas",
  "Horas decimal",
  "Atraso (min)",
  "Salida anticipada (min)",
  "Nota",
] as const;

function cell(value: string | null | undefined): string {
  if (value == null || value === "") return '""';
  return `"${String(value).replace(/"/g, '""')}"`;
}

function horaLocal(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleTimeString("es-CL", {
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
}

function duracion(min: number | null): string | null {
  if (min == null) return null;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

function buildCsv(rows: AsistenciaCsvRow[]): string {
  const lines = [HEADERS.map(cell).join(";")];

  for (const r of rows) {
    lines.push(
      [
        cell(new Date(r.date + "T12:00:00").toLocaleDateString("es-CL")),
        cell(r.name),
        cell(r.rut),
        cell(r.role),
        cell(horaLocal(r.checkedIn)),
        cell(horaLocal(r.checkedOut) ?? "sin marcar"),
        cell(duracion(r.minutos)),
        // Coma decimal: Excel en chileno no lee "8.25" como número.
        cell(r.minutos == null ? null : (r.minutos / 60).toFixed(2).replace(".", ",")),
        cell(r.late == null ? null : String(r.late)),
        cell(r.early == null ? null : String(r.early)),
        cell(r.note),
      ].join(";")
    );
  }

  return lines.join("\r\n");
}

export default function ExportAsistenciaCsvButton({
  rows,
  buildingName,
  days,
}: {
  rows: AsistenciaCsvRow[];
  buildingName?: string | null;
  days: number;
}) {
  const [done, setDone] = useState(false);
  const empty = rows.length === 0;

  function download() {
    if (empty) return;

    const slug = (buildingName ?? "portex")
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const blob = new Blob([String.fromCharCode(0xfeff) + buildCsv(rows)], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `asistencia-${slug}-${days}dias-${todayInChile()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    setDone(true);
    setTimeout(() => setDone(false), 2500);
  }

  return (
    <button
      onClick={download}
      disabled={empty}
      title={empty ? "No hay jornadas que exportar en este período" : undefined}
      style={{
        background: "white", border: "1px solid var(--px-line)", borderRadius: 8,
        padding: "9px 14px", fontSize: 13, fontWeight: 500,
        fontFamily: "var(--font-inter-tight), Inter, system-ui, sans-serif",
        cursor: empty ? "not-allowed" : "pointer",
        color: empty ? "var(--px-mid2)" : done ? "var(--px-ok)" : "var(--px-ink2)",
        opacity: empty ? 0.6 : 1, transition: "color 0.2s ease", whiteSpace: "nowrap",
      }}
    >
      {done ? "✓ Descargado" : `Exportar CSV · ${rows.length}`}
    </button>
  );
}

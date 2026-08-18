"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
// El entrypoint de navegador: este drawer corre en el cliente y así no se
// arrastra la variante de Node al bundle. `readSheet` devuelve las filas de la
// primera hoja — que es donde va el padrón.
import { readSheet } from "read-excel-file/browser";
import Drawer, { BTN_PRIMARY } from "./Drawer";
import { importResidents } from "@/app/actions";
import { csvWithBom, parseCsv, toText } from "@/lib/csv";

type Status = "activo" | "pendiente" | "inactivo";
type Tipo = "Propietario" | "Arrendatario" | "";

interface ParsedRow {
  torre: string;
  depto: string;
  unitCode: string; // constructed: torre ? `${torre}-${depto}` : depto
  name: string;
  tipo: Tipo;
  rut: string;
  contact: string;
  status: Status;
  _err?: string;
}

// ── Template ──────────────────────────────────────────────────────

const HEADERS = ["Torre", "N° Depto *", "Nombre Titular *", "Tipo", "RUT", "Contacto", "Estado"];
const EXAMPLES = [
  ["A",       "101", "Juan Pérez",     "Propietario",  "12.345.678-9", "+56 9 1234 5678", "activo"],
  ["A",       "102", "María González", "Arrendatario", "",             "+56 9 8765 4321", "activo"],
  ["Norte",   "201", "Carlos López",   "Propietario",  "9.876.543-2",  "",                "activo"],
  ["Sur",     "301", "Ana Soto",       "Arrendatario", "8.765.432-1",  "+56 9 5555 0000", "pendiente"],
  ["2",       "405", "Pedro Rojas",    "Propietario",  "",             "+56 9 1111 2222", "activo"],
  ["",        "502", "Laura Vera",     "Propietario",  "7.654.321-0",  "",                "activo"],
];

/** Lo que antes vivía en una segunda hoja del Excel que nadie abría. */
const INSTRUCCIONES: { campo: string; obligatorio: boolean; desc: string; ejemplos: string }[] = [
  { campo: "Torre",          obligatorio: false, desc: "Torre, bloque o sector. Si el condominio no tiene, déjala vacía.", ejemplos: "A · B · 1 · Norte · Sur · T1 · Bloque 3" },
  { campo: "N° Depto",       obligatorio: true,  desc: "Número o código del departamento.",                                 ejemplos: "101 · 4B · PH-1 · 12" },
  { campo: "Nombre Titular", obligatorio: true,  desc: "Nombre completo del residente principal.",                          ejemplos: "Juan Pérez López" },
  { campo: "Tipo",           obligatorio: false, desc: "Si el titular es dueño o arrienda.",                                ejemplos: "Propietario · Arrendatario" },
  { campo: "RUT",            obligatorio: false, desc: "RUT chileno, con o sin puntos.",                                    ejemplos: "12.345.678-9" },
  { campo: "Contacto",       obligatorio: false, desc: "Teléfono o correo.",                                                ejemplos: "+56 9 1234 5678 · juan@mail.com" },
  { campo: "Estado",         obligatorio: false, desc: "Por defecto queda activo.",                                         ejemplos: "activo · pendiente · inactivo" },
];

/**
 * Plantilla en CSV.
 *
 * Separador `;` y BOM UTF-8: es lo que hace que Excel en configuración chilena
 * abra el archivo en columnas y con las tildes derechas al hacer doble clic.
 */
function downloadTemplate() {
  const blob = new Blob([csvWithBom([HEADERS, ...EXAMPLES])], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "plantilla_residentes_portex.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ── Parser ────────────────────────────────────────────────────────

function buildUnitCode(torre: string, depto: string): string {
  const t = torre.trim();
  const d = depto.trim().toUpperCase();
  // Single letter/number → uppercase (A-101, 2-301)
  // Multi-char name → capitalize first letter (Norte-101, Sur-201)
  const tNorm = t.length <= 2 ? t.toUpperCase() : t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
  return tNorm ? `${tNorm}-${d}` : d;
}

async function readRows(file: File): Promise<string[][]> {
  const name = file.name.toLowerCase();

  if (name.endsWith(".csv") || name.endsWith(".txt")) {
    return parseCsv(await file.text());
  }

  if (name.endsWith(".xls")) {
    throw new Error(
      "El formato .xls antiguo no es compatible. Ábrelo en Excel y guárdalo como .xlsx o .csv."
    );
  }

  const rows = await readSheet(file);
  return rows.map((r) => r.map(toText));
}

async function parseFile(file: File): Promise<ParsedRow[]> {
  let rows: string[][];
  try {
    rows = (await readRows(file)).map((r) => r.map((c) => toText(c)));
  } catch (e) {
    // El mensaje del .xls es nuestro y explica qué hacer: no se pisa.
    if (e instanceof Error && e.message.startsWith("El formato")) throw e;
    throw new Error("No se pudo leer el archivo. Usa la plantilla en .csv o un .xlsx.");
  }

  const dataRows = rows.slice(1).filter((r) => r.some((c) => c));

  return dataRows.map((row) => {
    const [torre = "", depto = "", name = "", tipoRaw = "", rut = "", contact = "", statusRaw = ""] = row;

    const validTipos: Tipo[] = ["Propietario", "Arrendatario"];
    const tipoNorm = tipoRaw
      ? tipoRaw.charAt(0).toUpperCase() + tipoRaw.slice(1).toLowerCase()
      : "";
    const tipo: Tipo = validTipos.includes(tipoNorm as Tipo) ? (tipoNorm as Tipo) : "";

    const validStatuses: Status[] = ["activo", "pendiente", "inactivo"];
    const status: Status = validStatuses.includes(statusRaw.toLowerCase() as Status)
      ? (statusRaw.toLowerCase() as Status)
      : "activo";

    const unitCode = buildUnitCode(torre, depto);
    const p: ParsedRow = { torre, depto, unitCode, name, tipo, rut, contact, status };

    if (!depto) p._err = "Falta N° de depto";
    else if (!name) p._err = "Falta nombre titular";

    return p;
  });
}

// ── Styles ────────────────────────────────────────────────────────

const STATUS_COLOR: Record<Status, string> = {
  activo: "oklch(0.45 0.15 145)",
  pendiente: "oklch(0.5 0.15 60)",
  inactivo: "var(--px-mid)",
};
const STATUS_BG: Record<Status, string> = {
  activo: "oklch(0.95 0.05 145)",
  pendiente: "oklch(0.96 0.06 80)",
  inactivo: "var(--px-line2)",
};
const TIPO_STYLE: Record<string, { color: string; bg: string }> = {
  Propietario:  { color: "oklch(0.40 0.13 260)", bg: "oklch(0.94 0.04 260)" },
  Arrendatario: { color: "oklch(0.45 0.14 320)", bg: "oklch(0.95 0.04 320)" },
};

// ── Component ─────────────────────────────────────────────────────

export default function ImportResidentesButton() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [result, setResult] = useState<{ inserted: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  function close() {
    setOpen(false);
    setRows([]);
    setParseError(null);
    setActionError(null);
    setResult(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleFileDrop(file: File) {
    setParseError(null);
    setRows([]);
    try {
      const parsed = await parseFile(file);
      setRows(parsed);
    } catch (e) {
      setParseError(e instanceof Error ? e.message : "Error al procesar el archivo");
    }
  }

  async function handleImport() {
    const valid = rows.filter((r) => !r._err);
    if (!valid.length) return;
    setLoading(true);
    setActionError(null);
    const res = await importResidents(
      valid.map((r) => ({
        unitCode: r.unitCode,
        name: r.name,
        tipo: r.tipo || undefined,
        rut: r.rut || undefined,
        contact: r.contact || undefined,
        status: r.status,
      }))
    );
    if (res.ok) {
      setResult({ inserted: res.inserted });
      router.refresh();
    } else {
      setActionError(res.error ?? "Error al importar");
    }
    setLoading(false);
  }

  const validRows = rows.filter((r) => !r._err);
  const errorRows = rows.filter((r) => r._err);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          background: "white", border: "1px solid var(--px-line)",
          borderRadius: 8, padding: "9px 14px", fontSize: 13, fontWeight: 500,
          fontFamily: "var(--font-inter-tight), Inter, system-ui, sans-serif",
          cursor: "pointer", color: "var(--px-ink2)",
          display: "flex", alignItems: "center", gap: 6,
        }}
      >
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.7">
          <path d="M2 9.5v1.5h9V9.5M6.5 1.5v7M3.5 5.5l3 3 3-3" />
        </svg>
        Importar Excel
      </button>

      <Drawer open={open} onClose={close} title="Importar residentes" subtitle="PADRÓN · CARGA MASIVA" width={680}>

        {result ? (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <div style={{
              width: 56, height: 56, borderRadius: 28,
              background: "oklch(0.95 0.07 145)", margin: "0 auto 16px",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="oklch(0.45 0.15 145)" strokeWidth="2.2">
                <path d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em", marginBottom: 6 }}>
              {result.inserted} residentes importados
            </div>
            <div style={{ fontSize: 13, color: "var(--px-mid)", marginBottom: 28 }}>
              El padrón ha sido actualizado correctamente.
            </div>
            <button onClick={close} style={{ ...BTN_PRIMARY }}>Cerrar</button>
          </div>
        ) : (
          <>
            {/* ── Step 1: Template ── */}
            <div style={{
              padding: "14px 16px", borderRadius: 10,
              border: "1px solid var(--px-line)", marginBottom: 20,
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
            }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 3 }}>1. Descarga la plantilla</div>
                <div style={{ fontSize: 12, color: "var(--px-mid)", lineHeight: 1.6 }}>
                  Torre · N° Depto · Nombre Titular · Tipo · RUT · Contacto · Estado
                </div>
                <div style={{ fontSize: 11, color: "var(--px-mid)", marginTop: 2 }}>
                  Torre acepta letras, números o nombres — A, 1, Norte, Sur, Poniente…
                </div>
              </div>
              <button
                onClick={downloadTemplate}
                style={{
                  flexShrink: 0, background: "var(--px-paper)", border: "1px solid var(--px-line)",
                  borderRadius: 8, padding: "8px 14px", fontSize: 12.5, fontWeight: 500,
                  fontFamily: "var(--font-inter-tight), Inter, system-ui, sans-serif",
                  cursor: "pointer", color: "var(--px-ink)",
                  display: "flex", alignItems: "center", gap: 6,
                }}
              >
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.7">
                  <path d="M2 9.5v1.5h9V9.5M6.5 1.5v7M3.5 5.5l3 3 3-3" />
                </svg>
                .csv
              </button>
            </div>

            {/* Las instrucciones a la vista, no escondidas en una segunda hoja
                del archivo que nadie abre. */}
            <details style={{ marginBottom: 20 }}>
              <summary style={{ fontSize: 12.5, color: "var(--px-mid)", cursor: "pointer", listStyle: "none" }}>
                ¿Qué va en cada columna? ▾
              </summary>
              <div style={{ marginTop: 10, border: "1px solid var(--px-line)", borderRadius: 8, overflow: "hidden" }}>
                {INSTRUCCIONES.map((ins, i) => (
                  <div
                    key={ins.campo}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "108px 1fr",
                      gap: 10,
                      padding: "8px 12px",
                      fontSize: 12,
                      background: i % 2 ? "var(--px-paper)" : "white",
                      borderBottom: i < INSTRUCCIONES.length - 1 ? "1px solid var(--px-line2)" : "none",
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>
                      {ins.campo}
                      {ins.obligatorio && <span style={{ color: "var(--px-alert)" }}> *</span>}
                    </span>
                    <span style={{ color: "var(--px-mid)", lineHeight: 1.5 }}>
                      {ins.desc}
                      <span style={{ display: "block", fontFamily: "var(--font-jetbrains-mono)", fontSize: 10.5, marginTop: 2 }}>
                        {ins.ejemplos}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </details>

            {/* ── Step 2: Upload ── */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>2. Sube tu archivo</div>
              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  const file = e.dataTransfer.files[0];
                  if (file) handleFileDrop(file);
                }}
                onClick={() => fileRef.current?.click()}
                style={{
                  border: `2px dashed ${dragging ? "var(--px-ink)" : "var(--px-line)"}`,
                  borderRadius: 10, padding: "26px 20px", textAlign: "center",
                  cursor: "pointer", transition: "border-color 0.15s",
                  background: dragging ? "var(--px-paper)" : "white",
                }}
              >
                <svg width="26" height="26" viewBox="0 0 26 26" fill="none" stroke="var(--px-mid)" strokeWidth="1.5" style={{ marginBottom: 8, display: "block", margin: "0 auto 8px" }}>
                  <rect x="3" y="3" width="20" height="20" rx="3.5" />
                  <path d="M8 13h10M8 9.5h5M8 16.5h7" />
                </svg>
                <div style={{ fontSize: 13, fontWeight: 500, color: "var(--px-ink2)" }}>
                  Arrastra tu archivo aquí o haz clic para seleccionar
                </div>
                <div style={{ fontSize: 11.5, color: "var(--px-mid)", marginTop: 4 }}>
                  .xlsx · .csv
                </div>
                <input
                  ref={fileRef} type="file" accept=".xlsx,.csv"
                  style={{ display: "none" }}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileDrop(f); }}
                />
              </div>
            </div>

            {parseError && (
              <div style={{
                marginBottom: 16, padding: "9px 12px", borderRadius: 8,
                background: "oklch(0.96 0.05 28)", color: "var(--px-alert)",
                fontSize: 13, border: "1px solid oklch(0.88 0.12 28)",
              }}>
                {parseError}
              </div>
            )}

            {/* ── Step 3: Preview ── */}
            {rows.length > 0 && (
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>
                    3. Previsualización
                    <span style={{ fontWeight: 400, color: "var(--px-mid)", marginLeft: 8 }}>
                      {validRows.length} válidas{errorRows.length > 0 && ` · ${errorRows.length} con error`}
                    </span>
                  </div>
                  <button
                    onClick={() => { setRows([]); if (fileRef.current) fileRef.current.value = ""; }}
                    style={{ fontSize: 12, color: "var(--px-mid)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                  >
                    Limpiar
                  </button>
                </div>

                {/* Table */}
                <div style={{ border: "1px solid var(--px-line)", borderRadius: 8, overflow: "hidden" }}>
                  {/* Header */}
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "72px 1fr 110px 100px 78px",
                    padding: "7px 12px",
                    fontFamily: "var(--font-jetbrains-mono)", fontSize: 9.5,
                    letterSpacing: "0.08em", color: "var(--px-mid)",
                    background: "var(--px-paper)", gap: 8,
                    borderBottom: "1px solid var(--px-line)",
                  }}>
                    <span>UNIDAD</span>
                    <span>TITULAR</span>
                    <span>TIPO</span>
                    <span>RUT</span>
                    <span>ESTADO</span>
                  </div>

                  <div style={{ maxHeight: 280, overflowY: "auto" }}>
                    {rows.map((r, i) => (
                      <div
                        key={i}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "72px 1fr 110px 100px 78px",
                          padding: "8px 12px", gap: 8,
                          borderBottom: i < rows.length - 1 ? "1px solid var(--px-line2)" : "none",
                          fontSize: 12, alignItems: "center",
                          background: r._err ? "oklch(0.99 0.015 28)" : i % 2 ? "var(--px-paper)" : "white",
                        }}
                      >
                        {r._err ? (
                          <span style={{ gridColumn: "1 / -1", color: "var(--px-alert)", fontSize: 11.5, fontFamily: "var(--font-jetbrains-mono)" }}>
                            ✕ Fila {i + 2}: {r._err}
                            {(r.torre || r.depto || r.name) && (
                              <span style={{ color: "var(--px-mid)", marginLeft: 6 }}>
                                — {[r.torre && `Torre ${r.torre}`, r.depto && `Depto ${r.depto}`, r.name].filter(Boolean).join(", ")}
                              </span>
                            )}
                          </span>
                        ) : (
                          <>
                            <span style={{ fontFamily: "var(--font-jetbrains-mono)", fontWeight: 700, fontSize: 11.5 }}>
                              {r.unitCode}
                            </span>
                            <span style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {r.name}
                            </span>
                            <span>
                              {r.tipo ? (
                                <span style={{
                                  fontFamily: "var(--font-jetbrains-mono)", fontSize: 9.5, letterSpacing: "0.05em",
                                  padding: "2px 7px", borderRadius: 4,
                                  color: TIPO_STYLE[r.tipo]?.color ?? "var(--px-mid)",
                                  background: TIPO_STYLE[r.tipo]?.bg ?? "var(--px-line2)",
                                }}>
                                  {r.tipo.toUpperCase()}
                                </span>
                              ) : (
                                <span style={{ color: "var(--px-mid)", fontFamily: "var(--font-jetbrains-mono)", fontSize: 11 }}>—</span>
                              )}
                            </span>
                            <span style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 10.5, color: "var(--px-ink2)" }}>
                              {r.rut || "—"}
                            </span>
                            <span style={{
                              fontFamily: "var(--font-jetbrains-mono)", fontSize: 9.5, letterSpacing: "0.05em",
                              padding: "2px 6px", borderRadius: 4,
                              color: STATUS_COLOR[r.status], background: STATUS_BG[r.status],
                            }}>
                              {r.status.toUpperCase()}
                            </span>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {actionError && (
                  <div style={{
                    marginTop: 12, padding: "9px 12px", borderRadius: 8,
                    background: "oklch(0.96 0.05 28)", color: "var(--px-alert)",
                    fontSize: 13, border: "1px solid oklch(0.88 0.12 28)",
                  }}>
                    {actionError}
                  </div>
                )}

                {validRows.length > 0 && (
                  <button
                    onClick={handleImport}
                    disabled={loading}
                    style={{
                      ...BTN_PRIMARY, marginTop: 16,
                      opacity: loading ? 0.6 : 1,
                      cursor: loading ? "not-allowed" : "pointer",
                    }}
                  >
                    {loading
                      ? "Importando…"
                      : `Importar ${validRows.length} residente${validRows.length !== 1 ? "s" : ""}`}
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </Drawer>
    </>
  );
}

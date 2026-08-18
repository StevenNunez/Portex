"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ResidentRow } from "@/lib/db";
import Drawer, { FIELD, LABEL, BTN_PRIMARY } from "@/components/admin/Drawer";
import { updateResident } from "@/app/actions";
import { inviteResidentToPortal } from "@/app/citofono-actions";

type Status = "activo" | "pendiente" | "inactivo";
type Tipo   = "Propietario" | "Arrendatario" | "";

// ── Helpers ───────────────────────────────────────────────────────

function getTorre(unitCode: string): string {
  const idx = unitCode.indexOf("-");
  return idx > 0 ? unitCode.slice(0, idx) : "";
}

function sortKey(unitCode: string): string {
  // Natural sort: split prefix + numeric suffix  → "A-0101", "Norte-0201"
  return unitCode.replace(/(\d+)/g, (n) => n.padStart(6, "0"));
}

const STATUS_COLOR: Record<string, string> = {
  activo:    "oklch(0.45 0.15 145)",
  pendiente: "oklch(0.5 0.16 60)",
  inactivo:  "var(--px-mid)",
};
const STATUS_BG: Record<string, string> = {
  activo:    "oklch(0.95 0.05 145)",
  pendiente: "oklch(0.96 0.06 80)",
  inactivo:  "var(--px-line2)",
};
const TIPO_COLOR: Record<string, string> = {
  Propietario:  "oklch(0.40 0.13 260)",
  Arrendatario: "oklch(0.45 0.14 320)",
};
const TIPO_BG: Record<string, string> = {
  Propietario:  "oklch(0.94 0.04 260)",
  Arrendatario: "oklch(0.95 0.04 320)",
};

// ── Filter pill (select styled) ────────────────────────────────────

function FilterSelect({
  label, value, onChange, options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label style={{ position: "relative", display: "flex", alignItems: "center" }}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          appearance: "none",
          background: value !== "" ? "var(--px-ink)" : "white",
          color: value !== "" ? "var(--px-bone)" : "var(--px-ink2)",
          border: value !== "" ? "1.5px solid var(--px-ink)" : "1px solid var(--px-line)",
          borderRadius: 8, padding: "7px 30px 7px 12px",
          fontSize: 12.5, fontWeight: 500,
          fontFamily: "var(--font-inter-tight), Inter, system-ui, sans-serif",
          cursor: "pointer", outline: "none",
        }}
      >
        <option value="">{label}: Todos</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{label}: {o.label}</option>
        ))}
      </select>
      <svg
        width="9" height="9" viewBox="0 0 9 9" fill="none"
        stroke={value !== "" ? "var(--px-bone)" : "var(--px-mid)"}
        strokeWidth="1.5"
        style={{ position: "absolute", right: 10, pointerEvents: "none" }}
      >
        <path d="M2 3.5l2.5 2.5L7 3.5" />
      </svg>
    </label>
  );
}

// ── Main component ────────────────────────────────────────────────

export default function ResidentesClient({
  rows, isAdmin, initialSearch = "", perfiles = {},
}: {
  rows: ResidentRow[];
  /** Lo que cada departamento declaró desde su teléfono: cuántos viven y qué mascotas hay. */
  perfiles?: Record<string, { integrantes: number; mascotas: { species: string; name: string | null }[] }>;
  isAdmin: boolean;
  initialSearch?: string;
}) {
  const router = useRouter();

  // ── List filters ──
  const [search, setSearch] = useState(initialSearch);
  const [torreFilter, setTorreFilter] = useState("");
  const [estadoFilter, setEstadoFilter] = useState("");
  const [tipoFilter, setTipoFilter] = useState("");
  const [sort, setSort] = useState("unidad_asc");

  // ── Edit drawer ──
  const [editing, setEditing]         = useState<ResidentRow | null>(null);
  const [editUnit, setEditUnit]       = useState("");
  const [editName, setEditName]       = useState("");
  const [editHousehold, setEditHousehold] = useState("");
  const [editRut, setEditRut]         = useState("");
  const [editContact, setEditContact] = useState("");
  const [editStatus, setEditStatus]   = useState<Status>("activo");
  const [editTipo, setEditTipo]       = useState<Tipo>("");
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError]     = useState<string | null>(null);

  const [inviting, setInviting]           = useState<ResidentRow | null>(null);
  const [inviteEmail, setInviteEmail]     = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError]     = useState<string | null>(null);
  const [inviteDone, setInviteDone]       = useState(false);

  function openEdit(row: ResidentRow) {
    setEditing(row);
    setEditUnit(row.unit_code);
    setEditName(row.name);
    setEditHousehold(row.household ?? "");
    setEditRut(row.rut ?? "");
    setEditContact(row.contact ?? "");
    setEditStatus((row.status as Status) ?? "activo");
    setEditTipo((row.tags.find((t) => t === "Propietario" || t === "Arrendatario") ?? "") as Tipo);
    setEditError(null);
  }

  function closeEdit() {
    setEditing(null);
    setEditError(null);
  }

  // ── Invitación al portal del residente ──────────────────────────
  function openInvite(row: ResidentRow) {
    setInviting(row);
    // El contacto suele ser teléfono; solo sirve de borrador si es correo.
    setInviteEmail(row.contact?.includes("@") ? row.contact : "");
    setInviteError(null);
    setInviteDone(false);
  }

  function closeInvite() {
    setInviting(null);
    setInviteError(null);
    setInviteDone(false);
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviting || inviteLoading) return;
    setInviteLoading(true);
    setInviteError(null);

    const res = await inviteResidentToPortal({
      residentId: inviting.id,
      email: inviteEmail.trim(),
    });

    if (res.ok) {
      setInviteDone(true);
      router.refresh();
    } else {
      setInviteError(res.error ?? "No se pudo enviar la invitación");
    }
    setInviteLoading(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setEditLoading(true);
    setEditError(null);
    const res = await updateResident(editing.id, {
      unitCode: editUnit,
      name: editName,
      household: editHousehold || undefined,
      rut: editRut || undefined,
      contact: editContact || undefined,
      status: editStatus,
      tipo: editTipo || undefined,
    });
    if (res.ok) {
      closeEdit();
      router.refresh();
    } else {
      setEditError(res.error ?? "Error al guardar");
    }
    setEditLoading(false);
  }

  // Unique torres from data
  const torres = useMemo(() => {
    const set = new Set(rows.map((r) => getTorre(r.unit_code)).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es", { numeric: true }));
  }, [rows]);

  // Has any active filter?
  const hasFilter = !!(search || torreFilter || estadoFilter || tipoFilter);

  // Filtered + sorted
  const filtered = useMemo(() => {
    let result = rows;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.unit_code.toLowerCase().includes(q) ||
          (r.rut ?? "").toLowerCase().includes(q) ||
          (r.contact ?? "").toLowerCase().includes(q) ||
          (r.household ?? "").toLowerCase().includes(q)
      );
    }

    if (torreFilter) {
      result = result.filter((r) => getTorre(r.unit_code) === torreFilter);
    }

    if (estadoFilter) {
      result = result.filter((r) => r.status === estadoFilter);
    }

    if (tipoFilter) {
      result = result.filter((r) => r.tags.includes(tipoFilter));
    }

    return [...result].sort((a, b) => {
      if (sort === "unidad_desc") return sortKey(b.unit_code).localeCompare(sortKey(a.unit_code));
      if (sort === "nombre_az")   return a.name.localeCompare(b.name, "es");
      if (sort === "nombre_za")   return b.name.localeCompare(a.name, "es");
      return sortKey(a.unit_code).localeCompare(sortKey(b.unit_code)); // unidad_asc default
    });
  }, [rows, search, torreFilter, estadoFilter, tipoFilter, sort]);

  const activos    = filtered.filter((r) => r.status === "activo").length;
  const pendientes = filtered.filter((r) => r.status === "pendiente").length;
  const total      = filtered.length;

  function clearFilters() {
    setSearch("");
    setTorreFilter("");
    setEstadoFilter("");
    setTipoFilter("");
    setSort("unidad_asc");
  }

  return (
    <>
      {/* Stats bar */}
      <div style={{
        padding: "8px 32px",
        borderBottom: "1px solid var(--px-line2)",
        background: "var(--px-paper)",
        fontFamily: "var(--font-jetbrains-mono)", fontSize: 11,
        color: "var(--px-mid)", letterSpacing: "0.07em",
        display: "flex", alignItems: "center", gap: 20,
      }}>
        <span>{total} MOSTRADOS</span>
        <span style={{ color: STATUS_COLOR.activo }}>{activos} ACTIVOS</span>
        <span style={{ color: STATUS_COLOR.pendiente }}>{pendientes} PENDIENTES</span>
        <span>{rows.length} TOTAL EN PADRÓN</span>
        {hasFilter && (
          <button
            onClick={clearFilters}
            style={{
              marginLeft: "auto", fontSize: 11, color: "var(--px-mid)",
              background: "none", border: "none", cursor: "pointer",
              padding: 0, letterSpacing: "0.07em", textDecoration: "underline",
            }}
          >
            LIMPIAR FILTROS
          </button>
        )}
      </div>

      {/* Filter bar */}
      <div style={{
        padding: "10px 32px",
        borderBottom: "1px solid var(--px-line)",
        background: "white",
        display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
      }}>
        {/* Search */}
        <div style={{
          flex: 1, minWidth: 200,
          display: "flex", alignItems: "center", gap: 10,
          background: "white", border: "1px solid var(--px-line)", borderRadius: 8, padding: "7px 14px",
        }}>
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="var(--px-mid)" strokeWidth="1.6">
            <circle cx="5.5" cy="5.5" r="4" />
            <path d="M8.5 8.5l3 3" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nombre, RUT, unidad, contacto…"
            style={{
              border: "none", outline: "none", flex: 1,
              fontSize: 13, color: "var(--px-ink)", background: "transparent",
              fontFamily: "var(--font-inter-tight), Inter, system-ui, sans-serif",
            }}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--px-mid)", padding: 0, lineHeight: 1 }}
            >
              ×
            </button>
          )}
        </div>

        {/* Torre */}
        {torres.length > 0 && (
          <FilterSelect
            label="Torre"
            value={torreFilter}
            onChange={setTorreFilter}
            options={torres.map((t) => ({ value: t, label: t }))}
          />
        )}

        {/* Estado */}
        <FilterSelect
          label="Estado"
          value={estadoFilter}
          onChange={setEstadoFilter}
          options={[
            { value: "activo",    label: "Activo" },
            { value: "pendiente", label: "Pendiente" },
            { value: "inactivo",  label: "Inactivo" },
          ]}
        />

        {/* Tipo */}
        <FilterSelect
          label="Tipo"
          value={tipoFilter}
          onChange={setTipoFilter}
          options={[
            { value: "Propietario",  label: "Propietario" },
            { value: "Arrendatario", label: "Arrendatario" },
          ]}
        />

        {/* Ordenar */}
        <FilterSelect
          label="Ordenar"
          value={sort === "unidad_asc" ? "" : sort}
          onChange={(v) => setSort(v || "unidad_asc")}
          options={[
            { value: "unidad_asc",  label: "Unidad ↑" },
            { value: "unidad_desc", label: "Unidad ↓" },
            { value: "nombre_az",   label: "Nombre A-Z" },
            { value: "nombre_za",   label: "Nombre Z-A" },
          ]}
        />
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflow: "auto" }}>
        {/* Table header */}
        <div style={{
          display: "grid",
          gridTemplateColumns: `100px 1.5fr 100px 150px 110px 80px${isAdmin ? " 36px" : ""}`,
          padding: "9px 32px",
          fontFamily: "var(--font-jetbrains-mono)", fontSize: 10,
          letterSpacing: "0.08em", color: "var(--px-mid)",
          borderBottom: "1px solid var(--px-line)", background: "var(--px-paper)",
          alignItems: "center", gap: 12, position: "sticky", top: 0, zIndex: 1,
        }}>
          <span>UNIDAD</span>
          <span>TITULAR</span>
          <span>TIPO</span>
          <span>RUT · CONTACTO</span>
          <span>GRUPO</span>
          <span>ESTADO</span>
          {isAdmin && <span />}
        </div>

        {filtered.length === 0 ? (
          <div style={{
            padding: "60px 32px", textAlign: "center",
            fontFamily: "var(--font-jetbrains-mono)", fontSize: 12, color: "var(--px-mid)",
          }}>
            {hasFilter ? (
              <>
                Sin resultados para esa búsqueda.{" "}
                <button onClick={clearFilters} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--px-ink)", fontSize: 12, fontFamily: "var(--font-jetbrains-mono)", textDecoration: "underline" }}>
                  Limpiar filtros
                </button>
              </>
            ) : (
              "Sin residentes registrados."
            )}
          </div>
        ) : (
          filtered.map((r, i) => {
            const tipo = r.tags.find((t) => t === "Propietario" || t === "Arrendatario");
            const otrosTags = r.tags.filter((t) => t !== tipo);
            return (
              <div
                key={r.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: `100px 1.5fr 100px 150px 110px 80px${isAdmin ? " 36px" : ""}`,
                  padding: "11px 32px",
                  borderBottom: "1px solid var(--px-line2)",
                  fontSize: 13, alignItems: "center", gap: 12,
                  background: i % 2 ? "var(--px-paper)" : "white",
                }}
              >
                <span style={{ fontFamily: "var(--font-jetbrains-mono)", fontWeight: 700, fontSize: 12 }}>
                  {r.unit_code}
                </span>

                <span>
                  <div style={{ fontWeight: 500 }}>{r.name}</div>
                </span>

                <span>
                  {tipo ? (
                    <span style={{
                      fontFamily: "var(--font-jetbrains-mono)", fontSize: 9.5,
                      padding: "2px 7px", borderRadius: 4, letterSpacing: "0.05em",
                      color: TIPO_COLOR[tipo] ?? "var(--px-mid)",
                      background: TIPO_BG[tipo] ?? "var(--px-line2)",
                    }}>
                      {tipo.toUpperCase()}
                    </span>
                  ) : otrosTags.length > 0 ? (
                    <span style={{
                      fontFamily: "var(--font-jetbrains-mono)", fontSize: 9.5,
                      padding: "2px 7px", borderRadius: 4,
                      color: "var(--px-mid)", background: "var(--px-line2)",
                    }}>
                      {otrosTags[0]}
                    </span>
                  ) : (
                    <span style={{ color: "var(--px-mid)", fontSize: 12 }}>—</span>
                  )}
                </span>

                <div style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 11, lineHeight: 1.6 }}>
                  <div style={{ color: "var(--px-ink2)" }}>{r.rut ?? "—"}</div>
                  {r.contact && <div style={{ color: "var(--px-mid)" }}>{r.contact}</div>}
                </div>

                <span style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 11, color: "var(--px-mid)", lineHeight: 1.6 }}>
                  {(() => {
                    const perfil = perfiles[r.id];
                    const personas = perfil?.integrantes ?? 0;
                    const mascotas = perfil?.mascotas ?? [];
                    // Mientras el residente no llene su ficha se sigue mostrando
                    // el texto libre viejo: es lo único que hay de ese depto.
                    if (personas === 0 && mascotas.length === 0) return r.household || "—";
                    return (
                      <>
                        {personas > 0 && (
                          <div style={{ color: "var(--px-ink2)" }}>
                            {personas === 1 ? "1 integrante" : `${personas} integrantes`}
                          </div>
                        )}
                        {mascotas.length > 0 && (
                          <div title={mascotas.map((m) => m.name).filter(Boolean).join(", ")}>
                            {mascotas.length === 1
                              ? (mascotas[0].name ?? mascotas[0].species)
                              : `${mascotas.length} mascotas`}
                            {" 🐾"}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </span>

                <span>
                  <span style={{
                    fontFamily: "var(--font-jetbrains-mono)", fontSize: 10,
                    letterSpacing: "0.06em", padding: "3px 8px", borderRadius: 4,
                    color: STATUS_COLOR[r.status] ?? "var(--px-mid)",
                    background: STATUS_BG[r.status] ?? "var(--px-line2)",
                  }}>
                    {r.status.toUpperCase()}
                  </span>
                </span>

                {isAdmin && (
                  <span style={{ display: "flex", justifyContent: "center", gap: 2 }}>
                    <button
                      onClick={() => openInvite(r)}
                      title="Invitar al portal del residente"
                      style={{
                        background: "none", border: "none", cursor: "pointer",
                        padding: "4px 6px", borderRadius: 6, color: "var(--px-mid)",
                        display: "flex", alignItems: "center",
                        transition: "background 0.1s, color 0.1s",
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.background = "var(--px-line2)";
                        (e.currentTarget as HTMLButtonElement).style.color = "var(--px-ink)";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.background = "none";
                        (e.currentTarget as HTMLButtonElement).style.color = "var(--px-mid)";
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4">
                        <rect x="1" y="3" width="12" height="8.5" rx="1.2" />
                        <path d="M1.4 3.6L7 7.6l5.6-4" />
                      </svg>
                    </button>
                    <button
                      onClick={() => openEdit(r)}
                      title="Editar residente"
                      style={{
                        background: "none", border: "none", cursor: "pointer",
                        padding: "4px 6px", borderRadius: 6, color: "var(--px-mid)",
                        display: "flex", alignItems: "center",
                        transition: "background 0.1s, color 0.1s",
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.background = "var(--px-line2)";
                        (e.currentTarget as HTMLButtonElement).style.color = "var(--px-ink)";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.background = "none";
                        (e.currentTarget as HTMLButtonElement).style.color = "var(--px-mid)";
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M9.5 2.5l2 2L4 12H2v-2L9.5 2.5z" />
                      </svg>
                    </button>
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* ── Invitación al portal ── */}
      <Drawer
        open={!!inviting}
        onClose={closeInvite}
        title="Invitar al portal"
        subtitle={inviting ? `${inviting.unit_code} · ${inviting.name}` : undefined}
      >
        {inviting && (
          inviteDone ? (
            <div style={{ padding: "8px 0 4px" }}>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Invitación enviada</div>
              <p style={{ fontSize: 13.5, color: "var(--px-mid)", lineHeight: 1.55, margin: "0 0 18px" }}>
                {inviting.name} va a recibir un correo para crear su contraseña. Desde ese momento
                puede autorizar visitas a la unidad {inviting.unit_code} desde su teléfono.
              </p>
              <button type="button" onClick={closeInvite} style={BTN_PRIMARY}>
                Listo
              </button>
            </div>
          ) : (
            <form onSubmit={handleInvite}>
              <p style={{ fontSize: 13.5, color: "var(--px-mid)", lineHeight: 1.55, margin: "0 0 16px" }}>
                El residente recibe un correo, crea su contraseña y queda ligado a la unidad{" "}
                {inviting.unit_code}. Ahí puede anunciar visitas y aprobar a quien llegue a buscarlo.
              </p>

              <div style={{ marginBottom: 16 }}>
                <label style={LABEL}>Correo del residente</label>
                <input
                  required
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="correo@ejemplo.com"
                  style={FIELD}
                />
              </div>

              {inviteError && (
                <div style={{ fontSize: 13, color: "var(--px-alert)", marginBottom: 14 }}>
                  {inviteError}
                </div>
              )}

              <button type="submit" disabled={inviteLoading} style={BTN_PRIMARY}>
                {inviteLoading ? "Enviando…" : "Enviar invitación"}
              </button>
            </form>
          )
        )}
      </Drawer>

      {/* ── Edit drawer ── */}
      <Drawer open={!!editing} onClose={closeEdit} title="Editar residente" subtitle={editing?.unit_code}>
        {editing && (
          <form onSubmit={handleSave}>

            <div style={{ marginBottom: 16 }}>
              <label style={LABEL}>Código de unidad</label>
              <input
                required value={editUnit}
                onChange={(e) => setEditUnit(e.target.value.toUpperCase())}
                style={{ ...FIELD, fontFamily: "var(--font-jetbrains-mono), monospace", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}
              />
              <div style={{ fontSize: 11, color: "var(--px-mid)", marginTop: 4 }}>
                Cambiar la unidad refleja una mudanza o reasignación.
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={LABEL}>Nombre titular</label>
              <input required value={editName} onChange={(e) => setEditName(e.target.value)} style={FIELD} />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={LABEL}>Tipo</label>
              <div style={{ display: "flex", gap: 8 }}>
                {(["Propietario", "Arrendatario", ""] as Tipo[]).map((t) => (
                  <button
                    key={t} type="button"
                    onClick={() => setEditTipo(t)}
                    style={{
                      flex: 1, padding: "8px 0", borderRadius: 8, fontSize: 12, fontWeight: 500,
                      fontFamily: "var(--font-inter-tight), Inter, system-ui, sans-serif",
                      cursor: "pointer",
                      border: editTipo === t ? "2px solid var(--px-ink)" : "1px solid var(--px-line)",
                      background: editTipo === t ? "var(--px-ink)" : "white",
                      color: editTipo === t ? "var(--px-bone)" : "var(--px-ink2)",
                    }}
                  >
                    {t || "Sin tipo"}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={LABEL}>RUT</label>
                  <input value={editRut} onChange={(e) => setEditRut(e.target.value)} placeholder="12.345.678-9" style={FIELD} />
                </div>
                <div>
                  <label style={LABEL}>Contacto</label>
                  <input value={editContact} onChange={(e) => setEditContact(e.target.value)} placeholder="+56 9 1234 5678" style={FIELD} />
                </div>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={LABEL}>Grupo familiar</label>
              <input value={editHousehold} onChange={(e) => setEditHousehold(e.target.value)} placeholder="Ej: Juan + 2 hijos" style={FIELD} />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={LABEL}>Estado</label>
              <div style={{ display: "flex", gap: 8 }}>
                {(["activo", "pendiente", "inactivo"] as Status[]).map((s) => (
                  <button
                    key={s} type="button"
                    onClick={() => setEditStatus(s)}
                    style={{
                      flex: 1, padding: "8px 0", borderRadius: 8, fontSize: 12, fontWeight: 500,
                      fontFamily: "var(--font-inter-tight), Inter, system-ui, sans-serif",
                      cursor: "pointer",
                      border: editStatus === s ? "2px solid var(--px-ink)" : "1px solid var(--px-line)",
                      background: editStatus === s ? "var(--px-ink)" : "white",
                      color: editStatus === s ? "var(--px-bone)" : "var(--px-ink2)",
                      textTransform: "capitalize",
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {editError && (
              <div style={{
                marginBottom: 16, padding: "9px 12px", borderRadius: 8,
                background: "oklch(0.96 0.05 28)", color: "var(--px-alert)",
                fontSize: 13, border: "1px solid oklch(0.88 0.12 28)",
              }}>
                {editError}
              </div>
            )}

            <button type="submit" disabled={editLoading}
              style={{ ...BTN_PRIMARY, opacity: editLoading ? 0.6 : 1, cursor: editLoading ? "not-allowed" : "pointer" }}>
              {editLoading ? "Guardando…" : "Guardar cambios"}
            </button>
          </form>
        )}
      </Drawer>
    </>
  );
}

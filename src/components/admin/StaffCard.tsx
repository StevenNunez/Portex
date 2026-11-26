"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Drawer, { FIELD, LABEL, BTN_PRIMARY } from "./Drawer";
import { updateStaffMember, deactivateStaffMember } from "@/app/actions";
import type { StaffRow } from "@/lib/db";
import { formatRutInput } from "@/lib/rut";
import { STAFF_ROLES } from "@/lib/staff";

function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ marginBottom: 16 }}>{children}</div>;
}

function initials(name: string) {
  return name.split(" ").slice(0, 2).map((p) => p[0]?.toUpperCase() || "").join("");
}

export default function StaffCard({ staff }: { staff: StaffRow }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(staff.name);
  const [rut, setRut] = useState(staff.rut ?? "");
  const [role, setRole] = useState(staff.role);
  const [contact, setContact] = useState(staff.contact ?? "");
  const [email, setEmail] = useState(staff.email ?? "");
  const [emerNombre, setEmerNombre] = useState(staff.emergency_name ?? "");
  const [emerFono, setEmerFono] = useState(staff.emergency_phone ?? "");

  const [loading, setLoading] = useState(false);
  const [loadingDelete, setLoadingDelete] = useState(false);
  // Desactivar pide un segundo toque en el mismo botón, no un `confirm()` del
  // navegador: ese bloquea toda la pantalla y en el teléfono se ve como un
  // aviso del sistema, no de Portex.
  const [confirmandoBaja, setConfirmandoBaja] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setName(staff.name);
    setRut(staff.rut ?? "");
    setRole(staff.role);
    setContact(staff.contact ?? "");
    setEmail(staff.email ?? "");
    setEmerNombre(staff.emergency_name ?? "");
    setEmerFono(staff.emergency_phone ?? "");
    setError(null);
    setConfirmandoBaja(false);
  }

  function close() { setOpen(false); reset(); }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await updateStaffMember(staff.id, {
      name,
      rut: rut || undefined,
      role,
      contact: contact || undefined,
      email: email || undefined,
      emergencyName: emerNombre || undefined,
      emergencyPhone: emerFono || undefined,
    });
    setLoading(false);
    if (res.ok) {
      close();
      router.refresh();
    } else {
      setError(res.error ?? "No se guardaron los cambios. Prueba de nuevo.");
    }
  }

  async function handleDelete() {
    if (!confirmandoBaja) {
      setConfirmandoBaja(true);
      return;
    }
    setLoadingDelete(true);
    const res = await deactivateStaffMember(staff.id);
    if (res.ok) {
      setOpen(false);
      router.refresh();
    } else {
      setLoadingDelete(false);
      setError(res.error ?? "No se pudo desactivar. Prueba de nuevo.");
    }
  }

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        aria-label={`Editar a ${staff.name}`}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen(true);
          }
        }}
        style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "10px 14px", borderRadius: 8,
          background: "var(--px-paper)", border: "1px solid var(--px-line2)",
          minWidth: 200, cursor: "pointer", transition: "border 0.2s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.border = "1px solid var(--px-line)")}
        onMouseLeave={(e) => (e.currentTarget.style.border = "1px solid var(--px-line2)")}
      >
        <div style={{ width: 32, height: 32, borderRadius: 16, background: "var(--px-line)", color: "var(--px-ink2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600, flexShrink: 0 }}>
          {initials(staff.name)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500 }}>{staff.name}</div>
          <div style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 10, color: "var(--px-mid)" }}>
            {staff.role}
            {staff.contact ? ` · ${staff.contact}` : ""}
          </div>
          {/* Lo que el administrador necesita ver sin abrir nada: si esa
              persona puede entrar a Portex y si hay a quién llamar. */}
          <div style={{ display: "flex", gap: 5, marginTop: 5, flexWrap: "wrap" }}>
            {staff.profile_id ? (
              <Etiqueta texto="CON CUENTA" color="oklch(0.42 0.12 150)" fondo="oklch(0.95 0.05 150)" />
            ) : (
              <Etiqueta texto="SIN CUENTA" color="var(--px-mid)" fondo="var(--px-line2)" />
            )}
            {!staff.emergency_phone && (
              <Etiqueta texto="SIN EMERGENCIA" color="oklch(0.48 0.14 75)" fondo="oklch(0.95 0.06 75)" />
            )}
          </div>
        </div>
        <div style={{ color: "var(--px-mid)", fontSize: 14, flexShrink: 0 }}>✎</div>
      </div>

      <Drawer open={open} onClose={close} title="Editar personal" subtitle="STAFF · PERSONAL DEL EDIFICIO">
        <form onSubmit={handleUpdate}>
          <Row>
            <label style={{ display: "block" }}><span style={LABEL}>Nombre completo *</span>
            <input required value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Nombre y apellido" style={FIELD} /></label>
          </Row>
          <Row>
            <label style={{ display: "block" }}><span style={LABEL}>
              RUT{" "}
              <span style={{ fontWeight: 400, color: "var(--px-mid)", fontSize: 11 }}>
                — con esto marca su asistencia en portería
              </span>
            </span>
            <input value={rut} onChange={(e) => setRut(formatRutInput(e.target.value))}
              placeholder="Ej: 12.345.678-9" inputMode="numeric" maxLength={12}
              style={{ ...FIELD, fontFamily: "var(--font-jetbrains-mono)" }} /></label>
          </Row>
          <Row>
            <label style={{ display: "block" }}><span style={LABEL}>Rol *</span>
            <select value={role} onChange={(e) => setRole(e.target.value)}
              style={{ ...FIELD, cursor: "pointer" }}>
              {STAFF_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select></label>
          </Row>
          <Row>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ display: "block" }}><span style={LABEL}>Teléfono</span>
                <input value={contact} onChange={(e) => setContact(e.target.value)}
                  placeholder="+56 9 1234 5678" style={FIELD} /></label>
              </div>
              <div>
                <label style={{ display: "block" }}><span style={LABEL}>Correo</span>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="correo@ejemplo.com" style={FIELD} /></label>
              </div>
            </div>
          </Row>

          <Row>
            <span style={LABEL}>
              Contacto de emergencia{" "}
              <span style={{ fontWeight: 400, color: "var(--px-mid)", fontSize: 11 }}>
                — a quién llamar si algo pasa en el turno
              </span>
            </span>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <input value={emerNombre} onChange={(e) => setEmerNombre(e.target.value)}
                aria-label="Contacto de emergencia: nombre y parentesco"
                placeholder="Nombre y parentesco" style={FIELD} />
              <input value={emerFono} onChange={(e) => setEmerFono(e.target.value)}
                aria-label="Contacto de emergencia: teléfono"
                placeholder="+56 9 8765 4321" style={FIELD} />
            </div>
          </Row>

          {error && (
            <div style={{ marginBottom: 16, padding: "9px 12px", borderRadius: 8, background: "oklch(0.96 0.05 28)", color: "var(--px-alert)", fontSize: 13, border: "1px solid oklch(0.88 0.12 28)" }}>
              {error}
            </div>
          )}

          <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
            <button type="submit" disabled={loading || loadingDelete}
              style={{ ...BTN_PRIMARY, flex: 1, opacity: (loading || loadingDelete) ? 0.6 : 1, cursor: (loading || loadingDelete) ? "not-allowed" : "pointer" }}>
              {loading ? "Guardando…" : "Guardar cambios"}
            </button>
            <button type="button" onClick={handleDelete} onBlur={() => setConfirmandoBaja(false)}
              disabled={loading || loadingDelete}
              style={{
                flex: 1, padding: "11px", borderRadius: 8, fontSize: 14, fontWeight: 600,
                fontFamily: "var(--font-inter-tight), Inter, system-ui, sans-serif", letterSpacing: "-0.02em",
                background: confirmandoBaja ? "var(--px-alert)" : "transparent",
                color: confirmandoBaja ? "white" : "var(--px-alert)",
                border: "1px solid var(--px-alert)",
                cursor: (loading || loadingDelete) ? "not-allowed" : "pointer", opacity: (loading || loadingDelete) ? 0.6 : 1
              }}>
              {loadingDelete ? "Desactivando…" : confirmandoBaja ? "Confirmar: desactivar" : "Desactivar"}
            </button>
          </div>
          <p aria-live="polite" style={{ margin: "10px 0 0", fontSize: 12.5, lineHeight: 1.5, color: "var(--px-mid)" }}>
            {confirmandoBaja
              ? `${staff.name} deja de aparecer en el personal y no puede marcar asistencia. Su historial de turnos y entradas se mantiene.`
              : "Desactivar no borra su historial: los turnos y entradas siguen en los reportes."}
          </p>
        </form>
      </Drawer>
    </>
  );
}

function Etiqueta({ texto, color, fondo }: { texto: string; color: string; fondo: string }) {
  return (
    <span
      style={{
        fontFamily: "var(--font-jetbrains-mono)", fontSize: 8.5,
        letterSpacing: "0.06em", padding: "2px 6px", borderRadius: 4,
        color, background: fondo, whiteSpace: "nowrap",
      }}
    >
      {texto}
    </span>
  );
}

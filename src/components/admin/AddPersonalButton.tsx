"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Drawer, { FIELD, LABEL, BTN_PRIMARY } from "./Drawer";
import { addStaffMember } from "@/app/actions";
import { formatRutInput } from "@/lib/rut";
import { STAFF_ROLES } from "@/lib/staff";

function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ marginBottom: 16 }}>{children}</div>;
}

export default function AddPersonalButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [rut, setRut] = useState("");
  const [role, setRole] = useState("Conserje");
  const [contact, setContact] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; invited?: boolean; msg: string } | null>(null);

  function reset() {
    setName(""); setRut(""); setRole("Conserje"); setContact(""); setEmail(""); setResult(null);
  }

  function close() { setOpen(false); reset(); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    const res = await addStaffMember({
      name,
      rut: rut || undefined,
      role,
      contact: contact || undefined,
      email: email || undefined,
    });

    setLoading(false);

    if (!res.ok) {
      setResult({ ok: false, msg: res.error ?? "Error al agregar personal" });
      return;
    }

    // Show success, then close after a moment
    if (res.invited) {
      setResult({ ok: true, invited: true, msg: `✓ ${name} agregado e invitación enviada a ${email}` });
    } else if (res.error) {
      // Partial: created but invite failed
      setResult({ ok: false, invited: false, msg: res.error });
    } else {
      setResult({ ok: true, invited: false, msg: `✓ ${name} agregado correctamente` });
    }

    router.refresh();
    setTimeout(() => { close(); }, 2000);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          background: "white", border: "1px solid var(--px-line)",
          borderRadius: 8, padding: "9px 14px", fontSize: 13, fontWeight: 500,
          fontFamily: "var(--font-inter-tight), Inter, system-ui, sans-serif",
          cursor: "pointer", color: "var(--px-ink2)",
        }}
      >
        Agregar personal
      </button>

      <Drawer open={open} onClose={close} title="Agregar personal" subtitle="STAFF · PERSONAL DEL EDIFICIO">
        <form onSubmit={handleSubmit}>
          <Row>
            <label style={LABEL}>Nombre completo *</label>
            <input required value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Nombre y apellido" style={FIELD} />
          </Row>
          {/* El RUT es con lo que esta persona marca su jornada en la tablet
              de portería: sin él, el módulo de asistencia no la reconoce. */}
          <Row>
            <label style={LABEL}>
              RUT{" "}
              <span style={{ fontWeight: 400, color: "var(--px-mid)", fontSize: 11 }}>
                — con esto marca su asistencia en portería
              </span>
            </label>
            <input value={rut} onChange={(e) => setRut(formatRutInput(e.target.value))}
              placeholder="Ej: 12.345.678-9" inputMode="numeric" maxLength={12}
              style={{ ...FIELD, fontFamily: "var(--font-jetbrains-mono)" }} />
          </Row>
          <Row>
            <label style={LABEL}>Rol *</label>
            <select value={role} onChange={(e) => setRole(e.target.value)}
              style={{ ...FIELD, cursor: "pointer" }}>
              {STAFF_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </Row>
          <Row>
            <label style={LABEL}>Teléfono</label>
            <input value={contact} onChange={(e) => setContact(e.target.value)}
              placeholder="+56 9 1234 5678" style={FIELD} />
          </Row>

          {/* Email = invitación de acceso */}
          <Row>
            <label style={LABEL}>
              Email{" "}
              <span style={{ fontWeight: 400, color: "var(--px-mid)", fontSize: 11 }}>
                — opcional, envía invitación de acceso
              </span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="conserje@ejemplo.com"
              style={FIELD}
            />
            {email && (
              <div style={{
                marginTop: 8, padding: "8px 10px", borderRadius: 6,
                background: "oklch(0.94 0.04 250)", fontSize: 12,
                color: "oklch(0.40 0.14 250)", border: "1px solid oklch(0.88 0.09 250)",
              }}>
                Se enviará un correo para que <strong>{name || "el conserje"}</strong> cree su contraseña e ingrese a la app.
              </div>
            )}
          </Row>

          {result && (
            <div style={{
              marginBottom: 16, padding: "9px 12px", borderRadius: 8, fontSize: 13,
              background: result.ok ? "oklch(0.95 0.05 145)" : "oklch(0.96 0.05 28)",
              color: result.ok ? "var(--px-ok)" : "var(--px-alert)",
              border: `1px solid ${result.ok ? "oklch(0.88 0.12 145)" : "oklch(0.88 0.12 28)"}`,
            }}>
              {result.msg}
            </div>
          )}

          <button type="submit" disabled={loading}
            style={{ ...BTN_PRIMARY, opacity: loading ? 0.6 : 1, cursor: loading ? "not-allowed" : "pointer" }}>
            {loading ? "Guardando…" : email ? "Agregar y enviar invitación" : "Agregar personal"}
          </button>
        </form>
      </Drawer>
    </>
  );
}

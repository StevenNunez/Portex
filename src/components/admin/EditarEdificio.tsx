"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { guardarEdificio, guardarMiCuenta } from "@/app/config-actions";

/**
 * Los datos que el administrador tenía que pedir por correo para cambiar.
 *
 * La pantalla de configuración mostraba el nombre del edificio, las unidades
 * y su propio nombre como texto muerto: si el condominio cambiaba de nombre o
 * el administrador escribía mal el suyo en el registro, no había forma de
 * arreglarlo desde la app.
 */

const CAMPO: React.CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  fontSize: 13,
  fontFamily: "var(--font-inter-tight), Inter, system-ui, sans-serif",
  border: "1px solid var(--px-line)",
  borderRadius: 8,
  outline: "none",
  background: "white",
  color: "var(--px-ink)",
};

function Fila({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0, paddingBottom: 14, marginBottom: 14, borderBottom: "1px solid var(--px-line2)" }}>
      {children}
    </div>
  );
}

function Etiqueta({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ width: 180, flexShrink: 0, fontSize: 13, color: "var(--px-mid)" }}>
      {children}
    </span>
  );
}

export function EditarEdificio({
  nombre,
  unidades,
  organizacion,
}: {
  nombre: string;
  unidades: number | null;
  organizacion: string;
}) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [datos, setDatos] = useState({
    name: nombre,
    unitsTotal: unidades != null ? String(unidades) : "",
    orgName: organizacion,
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);

  async function guardar() {
    setGuardando(true);
    setError(null);
    const res = await guardarEdificio({
      name: datos.name,
      unitsTotal: datos.unitsTotal ? Number(datos.unitsTotal) : undefined,
      orgName: datos.orgName || undefined,
    });
    setGuardando(false);

    if (!res.ok) {
      setError(res.error ?? "No se pudo guardar");
      return;
    }
    setEditando(false);
    setListo(true);
    setTimeout(() => setListo(false), 2500);
    router.refresh();
  }

  return (
    <>
      {editando ? (
        <>
          <Fila>
            <Etiqueta>Nombre del edificio</Etiqueta>
            <input
              value={datos.name}
              onChange={(e) => setDatos({ ...datos, name: e.target.value })}
              style={CAMPO}
            />
          </Fila>
          <Fila>
            <Etiqueta>Unidades totales</Etiqueta>
            <input
              value={datos.unitsTotal}
              onChange={(e) => setDatos({ ...datos, unitsTotal: e.target.value.replace(/[^0-9]/g, "") })}
              inputMode="numeric"
              placeholder="Ej: 312"
              style={CAMPO}
            />
          </Fila>
          <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 16 }}>
            <Etiqueta>Organización</Etiqueta>
            <input
              value={datos.orgName}
              onChange={(e) => setDatos({ ...datos, orgName: e.target.value })}
              style={CAMPO}
            />
          </div>
        </>
      ) : (
        <>
          <Fila>
            <Etiqueta>Nombre del edificio</Etiqueta>
            <span style={{ fontSize: 13, fontWeight: 500 }}>{datos.name || "—"}</span>
          </Fila>
          <Fila>
            <Etiqueta>Unidades totales</Etiqueta>
            <span style={{ fontSize: 13, fontWeight: 500 }}>{datos.unitsTotal || "—"}</span>
          </Fila>
          <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 16 }}>
            <Etiqueta>Organización</Etiqueta>
            <span style={{ fontSize: 13, fontWeight: 500 }}>{datos.orgName || "—"}</span>
          </div>
        </>
      )}

      {error && (
        <div style={{ marginBottom: 12, fontSize: 12.5, color: "var(--px-alert)" }}>{error}</div>
      )}

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button
          onClick={() => (editando ? guardar() : setEditando(true))}
          disabled={guardando}
          style={{
            background: editando ? "var(--px-ink)" : "white",
            color: editando ? "var(--px-bone)" : "var(--px-ink2)",
            border: editando ? "none" : "1px solid var(--px-line)",
            borderRadius: 8,
            padding: "8px 14px",
            fontSize: 13,
            fontWeight: editando ? 600 : 500,
            fontFamily: "var(--font-inter-tight), Inter, system-ui, sans-serif",
            cursor: "pointer",
          }}
        >
          {guardando ? "Guardando…" : editando ? "Guardar cambios" : "Editar"}
        </button>
        {editando && (
          <button
            onClick={() => {
              setEditando(false);
              setDatos({
                name: nombre,
                unitsTotal: unidades != null ? String(unidades) : "",
                orgName: organizacion,
              });
              setError(null);
            }}
            style={{
              background: "transparent",
              border: "1px solid var(--px-line)",
              borderRadius: 8,
              padding: "8px 14px",
              fontSize: 13,
              fontFamily: "var(--font-inter-tight), Inter, system-ui, sans-serif",
              color: "var(--px-mid)",
              cursor: "pointer",
            }}
          >
            Cancelar
          </button>
        )}
        {listo && (
          <span style={{ fontSize: 12.5, color: "var(--px-ok)" }}>Guardado</span>
        )}
      </div>
    </>
  );
}

export function EditarMiCuenta({ nombre, rol }: { nombre: string; rol: string }) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [name, setName] = useState(nombre);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);

  async function guardar() {
    setGuardando(true);
    setError(null);
    const res = await guardarMiCuenta({ name });
    setGuardando(false);

    if (!res.ok) {
      setError(res.error ?? "No se pudo guardar");
      return;
    }
    setEditando(false);
    setListo(true);
    setTimeout(() => setListo(false), 2500);
    router.refresh();
  }

  return (
    <>
      <Fila>
        <Etiqueta>Nombre</Etiqueta>
        {editando ? (
          <input value={name} onChange={(e) => setName(e.target.value)} style={CAMPO} />
        ) : (
          <span style={{ fontSize: 13, fontWeight: 500 }}>{name}</span>
        )}
      </Fila>
      <Fila>
        <Etiqueta>Rol</Etiqueta>
        <span style={{ fontSize: 13, fontWeight: 500 }}>
          {rol === "admin" ? "Administrador" : rol}
        </span>
      </Fila>
      <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 16 }}>
        <Etiqueta>Contraseña</Etiqueta>
        <a href="/reset-password" style={{ fontSize: 13, color: "var(--px-ink)", textDecoration: "underline" }}>
          Cambiar contraseña →
        </a>
      </div>

      {error && (
        <div style={{ marginBottom: 12, fontSize: 12.5, color: "var(--px-alert)" }}>{error}</div>
      )}

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button
          onClick={() => (editando ? guardar() : setEditando(true))}
          disabled={guardando}
          style={{
            background: editando ? "var(--px-ink)" : "white",
            color: editando ? "var(--px-bone)" : "var(--px-ink2)",
            border: editando ? "none" : "1px solid var(--px-line)",
            borderRadius: 8,
            padding: "8px 14px",
            fontSize: 13,
            fontWeight: editando ? 600 : 500,
            fontFamily: "var(--font-inter-tight), Inter, system-ui, sans-serif",
            cursor: "pointer",
          }}
        >
          {guardando ? "Guardando…" : editando ? "Guardar cambios" : "Editar"}
        </button>
        {editando && (
          <button
            onClick={() => { setEditando(false); setName(nombre); setError(null); }}
            style={{
              background: "transparent",
              border: "1px solid var(--px-line)",
              borderRadius: 8,
              padding: "8px 14px",
              fontSize: 13,
              fontFamily: "var(--font-inter-tight), Inter, system-ui, sans-serif",
              color: "var(--px-mid)",
              cursor: "pointer",
            }}
          >
            Cancelar
          </button>
        )}
        {listo && <span style={{ fontSize: 12.5, color: "var(--px-ok)" }}>Guardado</span>}
      </div>
    </>
  );
}

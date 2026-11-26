"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import {
  agregarIntegrante,
  agregarMascota,
  confirmarPerfilAlDia,
  guardarDatosDelDepartamento,
  quitarIntegrante,
  quitarMascota,
} from "@/app/perfil-actions";
import { formatRut, formatRutInput } from "@/lib/rut";
import type { PetSpecies, Tenancy } from "@/lib/database.types";

/**
 * La ficha del departamento.
 *
 * Nada de esto lo necesita Portex para dejar entrar a alguien: es lo que el
 * administrador termina persiguiendo por WhatsApp cada vez que cambia algo.
 * Que lo mantenga el residente es lo único que hace que esté al día — él es
 * el que sabe cuándo se cambió de teléfono o cuándo llegó el perro.
 *
 * Por eso también existe el botón de "está todo bien": confirmar que la ficha
 * sigue vigente vale tanto como editarla, y es un toque en vez de un
 * formulario.
 */

export interface PerfilVisible {
  residentId: string;
  unitCode: string;
  name: string;
  contact: string | null;
  rut: string | null;
  tenancy: Tenancy | null;
  actualizadoEn: string | null;
  integrantes: { id: string; name: string; relationship: string | null }[];
  mascotas: { id: string; species: PetSpecies; name: string | null; notes: string | null }[];
}

const CARD: CSSProperties = {
  background: "white",
  border: "1px solid var(--px-line)",
  borderRadius: 16,
  padding: "18px 20px",
};

const MONO: CSSProperties = {
  fontFamily: "var(--font-jetbrains-mono)",
  fontSize: 10.5,
  letterSpacing: "0.08em",
  color: "var(--px-mid)",
};

const INPUT: CSSProperties = {
  width: "100%",
  padding: "13px 15px",
  fontSize: 16,
  fontFamily: "var(--font-inter-tight), Inter, system-ui, sans-serif",
  border: "1px solid var(--px-line)",
  borderRadius: 12,
  outline: "none",
  background: "white",
  color: "var(--px-ink)",
};

const TENENCIAS: { valor: Tenancy; label: string }[] = [
  { valor: "propietario", label: "Soy el dueño" },
  { valor: "arrendatario", label: "Arriendo" },
  { valor: "otro", label: "Otro" },
];

const ESPECIES: { valor: PetSpecies; label: string }[] = [
  { valor: "perro", label: "Perro" },
  { valor: "gato", label: "Gato" },
  { valor: "otro", label: "Otro" },
];

function haceCuanto(iso: string | null): string | null {
  if (!iso) return null;
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (dias <= 0) return "hoy";
  if (dias === 1) return "ayer";
  if (dias < 30) return `hace ${dias} días`;
  const meses = Math.floor(dias / 30);
  return meses === 1 ? "hace un mes" : `hace ${meses} meses`;
}

export default function PerfilDepto({ perfil }: { perfil: PerfilVisible }) {
  const [datos, setDatos] = useState({
    name: perfil.name,
    contact: perfil.contact ?? "",
    rut: perfil.rut ? formatRut(perfil.rut) : "",
    tenancy: perfil.tenancy,
  });
  const [editando, setEditando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmado, setConfirmado] = useState(false);

  const [integrantes, setIntegrantes] = useState(perfil.integrantes);
  const [nuevoIntegrante, setNuevoIntegrante] = useState({ name: "", relationship: "" });
  const [agregandoIntegrante, setAgregandoIntegrante] = useState(false);

  const [mascotas, setMascotas] = useState(perfil.mascotas);
  const [nuevaMascota, setNuevaMascota] = useState<{ species: PetSpecies; name: string; notes: string }>({
    species: "perro",
    name: "",
    notes: "",
  });
  const [agregandoMascota, setAgregandoMascota] = useState(false);

  const revisado = haceCuanto(perfil.actualizadoEn);

  async function guardarDatos() {
    setGuardando(true);
    setError(null);
    const res = await guardarDatosDelDepartamento({
      residentId: perfil.residentId,
      name: datos.name,
      contact: datos.contact || undefined,
      rut: datos.rut || undefined,
      tenancy: datos.tenancy,
    });
    setGuardando(false);
    if (!res.ok) {
      setError(res.error ?? "No se pudo guardar");
      return;
    }
    setEditando(false);
  }

  async function confirmar() {
    const res = await confirmarPerfilAlDia(perfil.residentId);
    if (res.ok) setConfirmado(true);
  }

  async function sumarIntegrante() {
    if (nuevoIntegrante.name.trim().length < 2) return;
    setAgregandoIntegrante(true);
    const res = await agregarIntegrante({
      residentId: perfil.residentId,
      name: nuevoIntegrante.name,
      relationship: nuevoIntegrante.relationship || undefined,
    });
    setAgregandoIntegrante(false);
    if (!res.ok) {
      setError(res.error ?? "No se pudo agregar");
      return;
    }
    // Se pinta al toque con un id temporal; el definitivo llega en el próximo
    // refresh y nadie nota la diferencia.
    setIntegrantes((prev) => [
      ...prev,
      {
        id: `nuevo-${Date.now()}`,
        name: nuevoIntegrante.name.trim(),
        relationship: nuevoIntegrante.relationship.trim() || null,
      },
    ]);
    setNuevoIntegrante({ name: "", relationship: "" });
  }

  async function borrarIntegrante(id: string) {
    const previo = integrantes;
    setIntegrantes((prev) => prev.filter((i) => i.id !== id));
    const res = await quitarIntegrante(id);
    if (!res.ok) setIntegrantes(previo);
  }

  async function sumarMascota() {
    setAgregandoMascota(true);
    const res = await agregarMascota({
      residentId: perfil.residentId,
      species: nuevaMascota.species,
      name: nuevaMascota.name || undefined,
      notes: nuevaMascota.notes || undefined,
    });
    setAgregandoMascota(false);
    if (!res.ok) {
      setError(res.error ?? "No se pudo agregar");
      return;
    }
    setMascotas((prev) => [
      ...prev,
      {
        id: `nueva-${Date.now()}`,
        species: nuevaMascota.species,
        name: nuevaMascota.name.trim() || null,
        notes: nuevaMascota.notes.trim() || null,
      },
    ]);
    setNuevaMascota({ species: "perro", name: "", notes: "" });
  }

  async function borrarMascota(id: string) {
    const previo = mascotas;
    setMascotas((prev) => prev.filter((m) => m.id !== id));
    const res = await quitarMascota(id);
    if (!res.ok) setMascotas(previo);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* ── Datos del departamento ─────────────────────────────── */}
      <section style={CARD}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.02em" }}>
              Tu departamento
            </div>
            <div style={{ fontSize: 13, color: "var(--px-mid)", marginTop: 2 }}>
              Esto lo ve la administración del edificio
            </div>
          </div>
          <button
            onClick={() => (editando ? guardarDatos() : setEditando(true))}
            disabled={guardando}
            style={{
              flexShrink: 0,
              background: editando ? "var(--px-ink)" : "transparent",
              color: editando ? "var(--px-bone)" : "var(--px-ink)",
              border: editando ? "none" : "1px solid var(--px-line)",
              borderRadius: 10,
              padding: "9px 14px",
              font: "inherit",
              fontSize: 13.5,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {guardando ? "Guardando…" : editando ? "Guardar" : "Editar"}
          </button>
        </div>

        {editando ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div>
              <div style={{ ...MONO, marginBottom: 6 }}>TU NOMBRE</div>
              <input aria-label="Tu nombre"
                value={datos.name}
                onChange={(e) => setDatos({ ...datos, name: e.target.value })}
                style={INPUT}
              />
            </div>
            <div>
              <div style={{ ...MONO, marginBottom: 6 }}>TELÉFONO</div>
              <input aria-label="Teléfono"
                value={datos.contact}
                onChange={(e) => setDatos({ ...datos, contact: e.target.value })}
                placeholder="+56 9 1234 5678"
                inputMode="tel"
                style={INPUT}
              />
            </div>
            <div>
              <div style={{ ...MONO, marginBottom: 6 }}>TU RUT</div>
              <input aria-label="Tu RUT"
                value={datos.rut}
                onChange={(e) => setDatos({ ...datos, rut: formatRutInput(e.target.value) })}
                placeholder="12.345.678-9"
                inputMode="numeric"
                maxLength={12}
                style={{ ...INPUT, fontFamily: "var(--font-jetbrains-mono)" }}
              />
            </div>
            <div>
              <div style={{ ...MONO, marginBottom: 6 }}>EN ESTE DEPARTAMENTO</div>
              <div style={{ display: "flex", gap: 6 }}>
                {TENENCIAS.map((t) => {
                  const activo = datos.tenancy === t.valor;
                  return (
                    <button
                      key={t.valor}
                      onClick={() => setDatos({ ...datos, tenancy: activo ? null : t.valor })}
                      style={{
                        flex: 1,
                        padding: "11px 8px",
                        background: activo ? "var(--px-ink)" : "white",
                        color: activo ? "var(--px-bone)" : "var(--px-ink)",
                        border: activo ? "1px solid var(--px-ink)" : "1px solid var(--px-line)",
                        borderRadius: 10,
                        font: "inherit",
                        fontSize: 13.5,
                        fontWeight: 500,
                        cursor: "pointer",
                      }}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Dato etiqueta="NOMBRE" valor={datos.name} />
            <Dato etiqueta="TELÉFONO" valor={datos.contact || "—"} />
            <Dato etiqueta="RUT" valor={datos.rut || "—"} mono />
            <Dato
              etiqueta="EN ESTE DEPARTAMENTO"
              valor={TENENCIAS.find((t) => t.valor === datos.tenancy)?.label ?? "Sin indicar"}
            />
          </div>
        )}

        {error && (
          <div style={{ marginTop: 12, fontSize: 13.5, color: "var(--px-alert)" }}>{error}</div>
        )}
      </section>

      {/* ── Quiénes viven acá ──────────────────────────────────── */}
      <section style={CARD}>
        <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.02em" }}>
          Quiénes viven acá
        </div>
        <div style={{ fontSize: 13, color: "var(--px-mid)", marginTop: 2, marginBottom: 14 }}>
          Para que la portería sepa a quién dejar pasar sin preguntarte
        </div>

        {integrantes.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
            {integrantes.map((i) => (
              <Fila
                key={i.id}
                titulo={i.name}
                detalle={i.relationship ?? undefined}
                onQuitar={() => borrarIntegrante(i.id)}
              />
            ))}
          </div>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          <input aria-label="Nombre del integrante"
            value={nuevoIntegrante.name}
            onChange={(e) => setNuevoIntegrante({ ...nuevoIntegrante, name: e.target.value })}
            placeholder="Nombre"
            style={{ ...INPUT, flex: 2 }}
          />
          <input aria-label="Parentesco"
            value={nuevoIntegrante.relationship}
            onChange={(e) => setNuevoIntegrante({ ...nuevoIntegrante, relationship: e.target.value })}
            placeholder="Hijo, pareja…"
            style={{ ...INPUT, flex: 1.4 }}
          />
          <BotonMas onClick={sumarIntegrante} disabled={agregandoIntegrante} />
        </div>
      </section>

      {/* ── Mascotas ───────────────────────────────────────────── */}
      <section style={CARD}>
        <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.02em" }}>Mascotas</div>
        <div style={{ fontSize: 13, color: "var(--px-mid)", marginTop: 2, marginBottom: 14 }}>
          Si alguna vez se arranca al pasillo, en portería van a saber de dónde salió
        </div>

        {mascotas.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
            {mascotas.map((m) => (
              <Fila
                key={m.id}
                titulo={m.name || ESPECIES.find((e) => e.valor === m.species)?.label || "Mascota"}
                detalle={[ESPECIES.find((e) => e.valor === m.species)?.label, m.notes]
                  .filter(Boolean)
                  .join(" · ")}
                onQuitar={() => borrarMascota(m.id)}
              />
            ))}
          </div>
        )}

        <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
          {ESPECIES.map((e) => {
            const activo = nuevaMascota.species === e.valor;
            return (
              <button
                key={e.valor}
                onClick={() => setNuevaMascota({ ...nuevaMascota, species: e.valor })}
                style={{
                  flex: 1,
                  padding: "10px 8px",
                  background: activo ? "var(--px-ink)" : "white",
                  color: activo ? "var(--px-bone)" : "var(--px-ink)",
                  border: activo ? "1px solid var(--px-ink)" : "1px solid var(--px-line)",
                  borderRadius: 10,
                  font: "inherit",
                  fontSize: 13.5,
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                {e.label}
              </button>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <input aria-label="Nombre de la mascota"
            value={nuevaMascota.name}
            onChange={(e) => setNuevaMascota({ ...nuevaMascota, name: e.target.value })}
            placeholder="Nombre"
            style={{ ...INPUT, flex: 1.4 }}
          />
          <input aria-label="Raza o tamaño"
            value={nuevaMascota.notes}
            onChange={(e) => setNuevaMascota({ ...nuevaMascota, notes: e.target.value })}
            placeholder="Raza, tamaño…"
            style={{ ...INPUT, flex: 2 }}
          />
          <BotonMas onClick={sumarMascota} disabled={agregandoMascota} />
        </div>
      </section>

      {/* ── Confirmación ───────────────────────────────────────── */}
      <section style={{ ...CARD, background: "var(--px-paper)" }}>
        <div style={{ fontSize: 14.5, fontWeight: 500, marginBottom: 4 }}>
          {confirmado
            ? "Listo, gracias"
            : revisado
              ? `Revisaste esta ficha ${revisado}`
              : "Nunca has revisado esta ficha"}
        </div>
        <div style={{ fontSize: 13, color: "var(--px-mid)", lineHeight: 1.5, marginBottom: confirmado ? 0 : 12 }}>
          {confirmado
            ? "La administración ya sabe que tus datos están al día."
            : "Si está todo bien, con un toque le avisas a la administración que sigue vigente."}
        </div>
        {!confirmado && (
          <button
            onClick={confirmar}
            style={{
              width: "100%",
              padding: "12px",
              background: "white",
              color: "var(--px-ink)",
              border: "1px solid var(--px-line)",
              borderRadius: 12,
              font: "inherit",
              fontSize: 14.5,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Está todo bien
          </button>
        )}
      </section>
    </div>
  );
}

function Dato({ etiqueta, valor, mono }: { etiqueta: string; valor: string; mono?: boolean }) {
  return (
    <div>
      <div style={MONO}>{etiqueta}</div>
      <div
        style={{
          fontSize: 15.5,
          marginTop: 2,
          fontFamily: mono ? "var(--font-jetbrains-mono)" : undefined,
        }}
      >
        {valor}
      </div>
    </div>
  );
}

function Fila({
  titulo,
  detalle,
  onQuitar,
}: {
  titulo: string;
  detalle?: string;
  onQuitar: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "11px 13px",
        background: "var(--px-paper)",
        border: "1px solid var(--px-line2)",
        borderRadius: 12,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 500 }}>{titulo}</div>
        {detalle && <div style={{ ...MONO, marginTop: 2 }}>{detalle.toUpperCase()}</div>}
      </div>
      <button
        onClick={onQuitar}
        aria-label={`Quitar ${titulo}`}
        style={{
          flexShrink: 0,
          background: "transparent",
          border: "1px solid var(--px-line)",
          borderRadius: 8,
          padding: "7px 11px",
          font: "inherit",
          fontSize: 13,
          color: "var(--px-alert)",
          cursor: "pointer",
        }}
      >
        Quitar
      </button>
    </div>
  );
}

function BotonMas({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label="Agregar"
      style={{
        flexShrink: 0,
        width: 48,
        background: "var(--px-ink)",
        color: "var(--px-bone)",
        border: "none",
        borderRadius: 12,
        fontSize: 22,
        cursor: disabled ? "default" : "pointer",
        lineHeight: 1,
      }}
    >
      +
    </button>
  );
}

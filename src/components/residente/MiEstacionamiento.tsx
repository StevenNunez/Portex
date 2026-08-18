"use client";

import { useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import {
  addMyVehicle,
  cancelMyParkingLoan,
  lendMyParkingSpot,
  removeMyVehicle,
} from "@/app/citofono-actions";
import { todayInChile } from "@/lib/fecha";
import type { MySpot, ResidentVehicle } from "@/lib/parking-types";

const MONO: CSSProperties = {
  fontFamily: "var(--font-jetbrains-mono)",
  fontSize: 10.5,
  letterSpacing: "0.08em",
  color: "var(--px-mid)",
};

const CARD: CSSProperties = {
  background: "white",
  border: "1px solid var(--px-line)",
  borderRadius: 16,
  padding: "18px 20px",
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

function fechaLarga(iso: string) {
  return new Date(iso).toLocaleDateString("es-CL", { timeZone: "America/Santiago",
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/** Los plazos en la unidad en que la gente piensa: días, no fechas. */
const PLAZOS = [
  { dias: 1, label: "Hoy" },
  { dias: 3, label: "3 días" },
  { dias: 7, label: "1 semana" },
  { dias: 15, label: "15 días" },
];

function enDias(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dias - 1);
  return todayInChile(d);
}

// ── Un estacionamiento del departamento ────────────────────────────

function SpotCard({ spot }: { spot: MySpot }) {
  const router = useRouter();
  const [abriendo, setAbriendo] = useState(false);
  const [hasta, setHasta] = useState(enDias(3));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const prestado = spot.isLent;

  async function prestar() {
    setGuardando(true);
    setError(null);
    const res = await lendMyParkingSpot(spot.id, hasta);
    if (res.ok) {
      setAbriendo(false);
      router.refresh();
    } else {
      setError(res.error ?? "No se pudo prestar");
    }
    setGuardando(false);
  }

  async function cancelar() {
    setGuardando(true);
    const res = await cancelMyParkingLoan(spot.id);
    if (res.ok) router.refresh();
    else setError(res.error ?? "No se pudo cancelar");
    setGuardando(false);
  }

  return (
    <div style={{ borderTop: "1px solid var(--px-line2)", paddingTop: 14, marginTop: 14 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
        <span style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em" }}>
          {spot.code}
        </span>
        {spot.notes && <span style={MONO}>{spot.notes.toUpperCase()}</span>}
      </div>

      {/* Quién lo está ocupando va primero: es la pregunta que el residente
          se hace al llegar y encontrarlo tomado. */}
      {spot.occupiedBy ? (
        <div
          style={{
            marginTop: 10, padding: "12px 14px", borderRadius: 12,
            background: "oklch(0.96 0.03 25)", border: "1px solid var(--px-alert)",
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--px-alert)" }}>
            Ocupado por {spot.occupiedBy.plate}
          </div>
          <div style={{ ...MONO, marginTop: 3 }}>
            {spot.occupiedBy.driverName?.toUpperCase() ?? "SIN NOMBRE"} · DESDE LAS{" "}
            {new Date(spot.occupiedBy.startedAt).toLocaleTimeString("es-CL", { timeZone: "America/Santiago",
              hour: "2-digit", minute: "2-digit", hour12: false,
            })}
          </div>
        </div>
      ) : prestado ? (
        <div style={{ marginTop: 10 }}>
          <div
            style={{
              padding: "12px 14px", borderRadius: 12,
              background: "oklch(0.95 0.05 150)", border: "1px solid var(--px-ok)",
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 600 }}>Prestado a las visitas</div>
            <div style={{ ...MONO, marginTop: 3 }}>
              HASTA EL {fechaLarga(spot.lentUntil as string).toUpperCase()}
            </div>
          </div>
          <button
            onClick={cancelar}
            disabled={guardando}
            style={{
              marginTop: 8, width: "100%", padding: "11px", borderRadius: 12,
              background: "white", border: "1px solid var(--px-line)",
              font: "inherit", fontSize: 14, color: "var(--px-ink2)", cursor: "pointer",
            }}
          >
            {guardando ? "…" : "Dejar de prestarlo"}
          </button>
        </div>
      ) : abriendo ? (
        <div style={{ marginTop: 12 }}>
          <div style={{ ...MONO, marginBottom: 8 }}>¿HASTA CUÁNDO?</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
            {PLAZOS.map((p) => {
              const valor = enDias(p.dias);
              const activo = hasta === valor;
              return (
                <button
                  key={p.dias}
                  onClick={() => setHasta(valor)}
                  style={{
                    flex: 1, minWidth: 70, padding: "9px 6px", borderRadius: 10,
                    font: "inherit", fontSize: 13, cursor: "pointer",
                    border: activo ? "2px solid var(--px-ink)" : "1px solid var(--px-line)",
                    background: activo ? "var(--px-ink)" : "white",
                    color: activo ? "var(--px-bone)" : "var(--px-ink2)",
                  }}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
          <input
            type="date"
            value={hasta}
            min={todayInChile()}
            onChange={(e) => setHasta(e.target.value)}
            style={{ ...INPUT, marginBottom: 10 }}
          />
          {error && (
            <div style={{ fontSize: 13, color: "var(--px-alert)", marginBottom: 10 }}>{error}</div>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => setAbriendo(false)}
              style={{
                flex: 1, padding: "12px", borderRadius: 12, background: "white",
                border: "1px solid var(--px-line)", font: "inherit", fontSize: 14,
                color: "var(--px-mid)", cursor: "pointer",
              }}
            >
              Cancelar
            </button>
            <button
              onClick={prestar}
              disabled={guardando}
              style={{
                flex: 1.4, padding: "12px", borderRadius: 12,
                background: "var(--px-ink)", color: "var(--px-bone)", border: "none",
                font: "inherit", fontSize: 14, fontWeight: 600, cursor: "pointer",
              }}
            >
              {guardando ? "Prestando…" : "Prestarlo"}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAbriendo(true)}
          style={{
            marginTop: 10, width: "100%", padding: "12px", borderRadius: 12,
            background: "white", border: "1px solid var(--px-line)",
            font: "inherit", fontSize: 14.5, color: "var(--px-ink2)", cursor: "pointer",
          }}
        >
          Prestarlo mientras no lo uso
        </button>
      )}
    </div>
  );
}

// ── Sección completa ───────────────────────────────────────────────

export default function MiEstacionamiento({
  spots,
  vehicles,
  residentId,
}: {
  spots: MySpot[];
  vehicles: ResidentVehicle[];
  residentId: string;
}) {
  const router = useRouter();
  const [plate, setPlate] = useState("");
  const [model, setModel] = useState("");
  const [agregando, setAgregando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function agregarAuto(e: React.FormEvent) {
    e.preventDefault();
    setAgregando(true);
    setError(null);
    const res = await addMyVehicle({ residentId, plate, model: model || undefined });
    if (res.ok) {
      setPlate("");
      setModel("");
      router.refresh();
    } else {
      setError(res.error ?? "No se pudo guardar");
    }
    setAgregando(false);
  }

  async function borrarAuto(id: string) {
    const res = await removeMyVehicle(id);
    if (res.ok) router.refresh();
    else setError(res.error ?? "No se pudo borrar");
  }

  const puedeAgregar = plate.trim().length >= 4;

  return (
    <>
      <section style={CARD}>
        <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.02em" }}>
          Tu estacionamiento
        </div>
        <div style={{ fontSize: 13.5, color: "var(--px-mid)", marginTop: 2 }}>
          {spots.length === 0
            ? "Tu departamento no tiene estacionamiento asignado"
            : "Préstalo cuando no lo uses y la portería podrá dárselo a una visita"}
        </div>

        {spots.map((spot) => (
          <SpotCard key={spot.id} spot={spot} />
        ))}
      </section>

      <section style={CARD}>
        <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.02em" }}>Tus autos</div>
        <div style={{ fontSize: 13.5, color: "var(--px-mid)", marginTop: 2, marginBottom: 14 }}>
          Para que la conserjería sepa que el auto es tuyo y no lo trate como visita
        </div>

        {vehicles.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
            {vehicles.map((v) => (
              <div
                key={v.id}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  gap: 10, padding: "11px 14px", borderRadius: 12,
                  background: "var(--px-paper)", border: "1px solid var(--px-line)",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 15, fontWeight: 600, letterSpacing: "0.04em" }}>
                    {v.plate}
                  </div>
                  {v.model && (
                    <div style={{ fontSize: 12.5, color: "var(--px-mid)", marginTop: 1 }}>{v.model}</div>
                  )}
                </div>
                <button
                  onClick={() => borrarAuto(v.id)}
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    color: "var(--px-mid)", fontSize: 13, padding: "4px 8px",
                  }}
                >
                  Quitar
                </button>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={agregarAuto} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <input
            value={plate}
            onChange={(e) => setPlate(e.target.value.toUpperCase())}
            placeholder="Patente · ABCD12"
            maxLength={8}
            style={{ ...INPUT, fontFamily: "var(--font-jetbrains-mono)", letterSpacing: "0.05em" }}
          />
          <input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="Marca y color · opcional"
            style={INPUT}
          />
          {error && <div style={{ fontSize: 13, color: "var(--px-alert)" }}>{error}</div>}
          <button
            type="submit"
            disabled={agregando || !puedeAgregar}
            style={{
              padding: "13px", borderRadius: 12, border: "none",
              background: puedeAgregar ? "var(--px-ink)" : "var(--px-line)",
              color: "var(--px-bone)", font: "inherit", fontSize: 15, fontWeight: 600,
              cursor: puedeAgregar ? "pointer" : "not-allowed",
            }}
          >
            {agregando ? "Guardando…" : "Agregar auto"}
          </button>
        </form>
      </section>
    </>
  );
}

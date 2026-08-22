"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";
import MarcaPortex from "@/components/MarcaPortex";
import {
  createOnboardingOrg,
  createOnboardingBuilding,
  inviteConserje,
} from "@/app/actions";

type Step = "org" | "building" | "staff" | "done";

const INPUT_STYLE: CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  fontSize: 14,
  fontFamily: "var(--font-inter-tight), Inter, system-ui, sans-serif",
  border: "1px solid var(--px-line)",
  borderRadius: 8,
  outline: "none",
  background: "white",
  color: "var(--px-ink)",
  letterSpacing: "-0.005em",
};

const BTN_PRIMARY: CSSProperties = {
  width: "100%",
  padding: "11px",
  background: "var(--px-ink)",
  color: "var(--px-bone)",
  border: "none",
  borderRadius: 8,
  fontSize: 14,
  fontWeight: 600,
  fontFamily: "var(--font-inter-tight), Inter, system-ui, sans-serif",
  letterSpacing: "-0.02em",
  cursor: "pointer",
};

const BTN_GHOST: CSSProperties = {
  ...BTN_PRIMARY,
  background: "transparent",
  color: "var(--px-mid)",
  border: "1px solid var(--px-line)",
  marginTop: 8,
};

function StepDots({ step }: { step: Step }) {
  const steps: Step[] = ["org", "building", "staff"];
  const idx = steps.indexOf(step);
  return (
    <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 32 }}>
      {steps.map((s, i) => (
        <div
          key={s}
          style={{
            width: i === idx ? 20 : 8,
            height: 8,
            borderRadius: 4,
            background: i <= idx ? "var(--px-ink)" : "var(--px-line)",
            transition: "all 0.2s",
          }}
        />
      ))}
    </div>
  );
}

export default function OnboardingPage() {
  const router = useRouter();

  const [step, setStep] = useState<Step>("org");
  const [orgId, setOrgId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Step 1
  const [orgName, setOrgName] = useState("");
  const [city, setCity] = useState("Santiago");

  // Step 2
  const [buildingName, setBuildingName] = useState("");
  const [towers, setTowers] = useState(1);
  const [unitsPerTower, setUnitsPerTower] = useState(20);

  // Step 3
  const [staffEmail, setStaffEmail] = useState("");

  async function handleOrgSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await createOnboardingOrg({ name: orgName, city });
    if (!result.ok) {
      setError(result.error ?? "Error al crear el condominio");
      setLoading(false);
      return;
    }
    setOrgId(result.orgId!);
    setBuildingName(orgName);
    setStep("building");
    setLoading(false);
  }

  async function handleBuildingSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await createOnboardingBuilding({
      name: buildingName,
      orgId: orgId!,
      towers,
      unitsPerTower,
    });
    if (!result.ok) {
      setError(result.error ?? "Error al crear el edificio");
      setLoading(false);
      return;
    }
    setStep("staff");
    setLoading(false);
  }

  async function handleStaffSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    if (staffEmail && orgId) {
      const result = await inviteConserje({ email: staffEmail, organizationId: orgId });
      if (!result.ok) {
        setError(result.error ?? "Error al enviar la invitación");
        setLoading(false);
        return;
      }
    }
    setStep("done");
    setLoading(false);
  }

  function goToAdmin() {
    router.push("/admin");
    router.refresh();
  }

  const wrapperStyle: CSSProperties = {
    minHeight: "100dvh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    background: "var(--px-bone)",
    padding: "40px 20px",
  };

  const cardStyle: CSSProperties = {
    width: "100%",
    maxWidth: 440,
    background: "white",
    border: "1px solid var(--px-line)",
    borderRadius: 16,
    padding: "36px 32px",
  };

  const errorBlock = error ? (
    <div
      style={{
        background: "oklch(0.96 0.05 28)",
        border: "1px solid oklch(0.88 0.12 28)",
        borderRadius: 8,
        padding: "10px 14px",
        marginBottom: 20,
        fontSize: 13,
        color: "oklch(0.40 0.18 28)",
      }}
    >
      {error}
    </div>
  ) : null;

  // ── Done ──────────────────────────────────────────────────────
  if (step === "done") {
    return (
      <div style={wrapperStyle}>
        <MarcaPortex />
        <div style={{ ...cardStyle, textAlign: "center" }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: "oklch(0.95 0.05 145)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 24px",
              fontSize: 24,
            }}
          >
            ✓
          </div>
          <h2
            style={{
              margin: "0 0 12px",
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: "-0.03em",
            }}
          >
            ¡Todo listo!
          </h2>
          <p
            style={{
              fontSize: 14,
              color: "var(--px-mid)",
              lineHeight: 1.6,
              margin: "0 0 32px",
            }}
          >
            Tu condominio está configurado. Puedes empezar a gestionar accesos desde el panel.
          </p>
          <button onClick={goToAdmin} style={BTN_PRIMARY}>
            Ir al panel →
          </button>
        </div>
      </div>
    );
  }

  // ── Step 1: Org ───────────────────────────────────────────────
  if (step === "org") {
    return (
      <div style={wrapperStyle}>
        <MarcaPortex />
        <div style={cardStyle}>
          <StepDots step={step} />
          <h1 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 700, letterSpacing: "-0.03em" }}>
            Tu condominio
          </h1>
          <p style={{ margin: "0 0 28px", fontSize: 14, color: "var(--px-mid)", lineHeight: 1.5 }}>
            ¿Cómo se llama tu edificio o condominio?
          </p>
          {errorBlock}
          <form onSubmit={handleOrgSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6, color: "var(--px-ink2)" }}>
                Nombre del condominio
              </label>
              <input
                type="text"
                required
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="Ej: Condominio Las Palmas"
                style={INPUT_STYLE}
              />
            </div>
            <div style={{ marginBottom: 28 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6, color: "var(--px-ink2)" }}>
                Ciudad
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Santiago"
                style={INPUT_STYLE}
              />
            </div>
            <button type="submit" disabled={loading} style={{ ...BTN_PRIMARY, opacity: loading ? 0.6 : 1, cursor: loading ? "not-allowed" : "pointer" }}>
              {loading ? "Guardando…" : "Continuar →"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── Step 2: Building ──────────────────────────────────────────
  if (step === "building") {
    return (
      <div style={wrapperStyle}>
        <MarcaPortex />
        <div style={cardStyle}>
          <StepDots step={step} />
          <h1 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 700, letterSpacing: "-0.03em" }}>
            Estructura del edificio
          </h1>
          <p style={{ margin: "0 0 28px", fontSize: 14, color: "var(--px-mid)", lineHeight: 1.5 }}>
            Configura las torres y unidades. Podrás ajustar esto después.
          </p>
          {errorBlock}
          <form onSubmit={handleBuildingSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6, color: "var(--px-ink2)" }}>
                Nombre del edificio
              </label>
              <input
                type="text"
                required
                value={buildingName}
                onChange={(e) => setBuildingName(e.target.value)}
                style={INPUT_STYLE}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 10, color: "var(--px-ink2)" }}>
                Número de torres
              </label>
              {/* Quick-select buttons */}
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setTowers(n)}
                    style={{
                      flex: 1,
                      padding: "9px 0",
                      borderRadius: 8,
                      fontSize: 14,
                      fontWeight: 600,
                      fontFamily: "var(--font-inter-tight), Inter, system-ui, sans-serif",
                      cursor: "pointer",
                      border: towers === n ? "2px solid var(--px-ink)" : "1px solid var(--px-line)",
                      background: towers === n ? "var(--px-ink)" : "white",
                      color: towers === n ? "var(--px-bone)" : "var(--px-ink2)",
                    }}
                  >
                    {n}
                  </button>
                ))}
              </div>
              {/* Manual input with stepper */}
              <div style={{ display: "flex", alignItems: "center", gap: 0, border: "1px solid var(--px-line)", borderRadius: 8, overflow: "hidden" }}>
                <button
                  type="button"
                  onClick={() => setTowers((t) => Math.max(1, t - 1))}
                  style={{
                    padding: "9px 16px", fontSize: 18, lineHeight: 1,
                    background: "var(--px-paper)", border: "none", borderRight: "1px solid var(--px-line)",
                    cursor: "pointer", color: "var(--px-ink2)", fontFamily: "monospace",
                  }}
                >
                  −
                </button>
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={towers}
                  onChange={(e) => {
                    const v = parseInt(e.target.value);
                    if (!isNaN(v) && v >= 1) setTowers(v);
                  }}
                  style={{
                    flex: 1, padding: "9px 0", textAlign: "center",
                    fontSize: 15, fontWeight: 600, border: "none", outline: "none",
                    fontFamily: "var(--font-jetbrains-mono), monospace",
                    background: "white", color: "var(--px-ink)",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setTowers((t) => t + 1)}
                  style={{
                    padding: "9px 16px", fontSize: 18, lineHeight: 1,
                    background: "var(--px-paper)", border: "none", borderLeft: "1px solid var(--px-line)",
                    cursor: "pointer", color: "var(--px-ink2)", fontFamily: "monospace",
                  }}
                >
                  +
                </button>
              </div>
            </div>

            <div style={{ marginBottom: 28 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6, color: "var(--px-ink2)" }}>
                Unidades por torre
              </label>
              {/* El deslizador sirve para tantear, pero clavar un número exacto
                  con el dedo es imposible: al lado va el campo para escribirlo. */}
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <input
                  type="range"
                  min={1}
                  max={200}
                  step={1}
                  value={Math.min(unitsPerTower, 200)}
                  onChange={(e) => setUnitsPerTower(Number(e.target.value))}
                  aria-label="Unidades por torre"
                  style={{ flex: 1, accentColor: "var(--px-ink)" }}
                />
                <div style={{ display: "flex", alignItems: "center", border: "1px solid var(--px-line)", borderRadius: 8, overflow: "hidden", flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={() => setUnitsPerTower((u) => Math.max(1, u - 1))}
                    aria-label="Una unidad menos"
                    style={{
                      padding: "9px 13px", fontSize: 18, lineHeight: 1,
                      background: "var(--px-paper)", border: "none", borderRight: "1px solid var(--px-line)",
                      cursor: "pointer", color: "var(--px-ink2)", fontFamily: "monospace",
                    }}
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={999}
                    value={unitsPerTower}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      setUnitsPerTower(isNaN(v) ? 0 : Math.min(999, Math.max(0, v)));
                    }}
                    onBlur={() => setUnitsPerTower((u) => (u < 1 ? 1 : u))}
                    style={{
                      width: 64, padding: "9px 0", textAlign: "center",
                      fontSize: 15, fontWeight: 600, border: "none", outline: "none",
                      fontFamily: "var(--font-jetbrains-mono), monospace",
                      background: "white", color: "var(--px-ink)",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setUnitsPerTower((u) => Math.min(999, u + 1))}
                    aria-label="Una unidad más"
                    style={{
                      padding: "9px 13px", fontSize: 18, lineHeight: 1,
                      background: "var(--px-paper)", border: "none", borderLeft: "1px solid var(--px-line)",
                      cursor: "pointer", color: "var(--px-ink2)", fontFamily: "monospace",
                    }}
                  >
                    +
                  </button>
                </div>
              </div>
              <div style={{ marginTop: 8, fontSize: 12, color: "var(--px-mid)" }}>
                Total:{" "}
                <strong style={{ color: "var(--px-ink)" }}>
                  {towers * unitsPerTower} unidades
                </strong>
              </div>
            </div>

            <button type="submit" disabled={loading} style={{ ...BTN_PRIMARY, opacity: loading ? 0.6 : 1, cursor: loading ? "not-allowed" : "pointer" }}>
              {loading ? "Guardando…" : "Continuar →"}
            </button>
            <button type="button" onClick={() => setStep("org")} style={BTN_GHOST}>
              ← Atrás
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── Step 3: Staff ─────────────────────────────────────────────
  return (
    <div style={wrapperStyle}>
      <MarcaPortex />
      <div style={cardStyle}>
        <StepDots step={step} />
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: "-0.03em" }}>
            ¿Invitamos a un conserje?
          </h1>
          <span
            style={{
              fontFamily: "var(--font-jetbrains-mono)", fontSize: 9.5, letterSpacing: "0.08em",
              padding: "3px 7px", borderRadius: 5, color: "var(--px-mid)",
              background: "var(--px-paper)", border: "1px solid var(--px-line2)",
            }}
          >
            OPCIONAL
          </span>
        </div>
        <p style={{ margin: "0 0 28px", fontSize: 14, color: "var(--px-mid)", lineHeight: 1.5 }}>
          Le llega un correo para que cree su contraseña y entre directo a la pantalla
          de portería. Si todavía no sabes quién va a ser, sáltalo: se invita cuando
          quieras desde <strong style={{ color: "var(--px-ink2)", fontWeight: 500 }}>Configuración → Personal</strong>.
        </p>
        {errorBlock}
        <form onSubmit={handleStaffSubmit}>
          <div style={{ marginBottom: 28 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6, color: "var(--px-ink2)" }}>
              Email del conserje
            </label>
            <input
              type="email"
              value={staffEmail}
              onChange={(e) => setStaffEmail(e.target.value)}
              placeholder="conserje@ejemplo.com"
              style={INPUT_STYLE}
            />
          </div>

          <button
            type="submit"
            disabled={loading || !staffEmail}
            style={{
              ...BTN_PRIMARY,
              opacity: loading || !staffEmail ? 0.45 : 1,
              cursor: loading || !staffEmail ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Enviando…" : "Enviar invitación →"}
          </button>

          {/* Saltar no es "atrás": es una salida de primera clase. */}
          <button
            type="button"
            onClick={() => { setStaffEmail(""); setStep("done"); }}
            disabled={loading}
            style={{ ...BTN_GHOST, color: "var(--px-ink2)" }}
          >
            Lo hago después, ir al panel →
          </button>
          <button type="button" onClick={() => setStep("building")} style={{ ...BTN_GHOST, marginTop: 8 }}>
            ← Atrás
          </button>
        </form>
      </div>
    </div>
  );
}

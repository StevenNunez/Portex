"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Drawer, { FIELD, LABEL, BTN_PRIMARY } from "./Drawer";
import { crearAviso } from "@/app/avisos-actions";
import { NOTICE_LABEL, NOTICE_KINDS, type NoticeKind } from "@/lib/avisos-tipos";

/**
 * Publicar un aviso.
 *
 * "Mañana de 14:00 a 17:00 cortan el agua" tiene que llegar antes de que
 * pase, no después. Por eso el aviso se programa con su ventana horaria y
 * sale al teléfono de todos en el momento de publicarlo.
 */

function Row({ children }: { children: React.ReactNode }) {
  // `flex: 1` con `minWidth` para que los pares de campos se repartan el
  // ancho y, si no alcanza, se pongan uno bajo el otro en vez de desbordar.
  return <div style={{ marginBottom: 16, flex: 1, minWidth: 190 }}>{children}</div>;
}

/** "2026-08-18T14:00", que es lo que espera un input datetime-local. */
function paraInput(d: Date) {
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 16);
}

export default function AddAvisoButton({ unidades }: { unidades: string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const [kind, setKind] = useState<NoticeKind>("agua");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [scope, setScope] = useState<"edificio" | "unidad">("edificio");
  const [unitCode, setUnitCode] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [notificar, setNotificar] = useState(true);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  function abrir() {
    const ahora = new Date();
    setKind("agua");
    setTitle("");
    setBody("");
    setScope("edificio");
    setUnitCode("");
    setStartsAt(paraInput(ahora));
    setEndsAt(paraInput(new Date(ahora.getTime() + 3 * 3_600_000)));
    setNotificar(true);
    setError(null);
    setOk(null);
    setOpen(true);
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const res = await crearAviso({
      kind,
      title,
      body: body || undefined,
      scope,
      unitCode: scope === "unidad" ? unitCode : undefined,
      startsAt: startsAt || undefined,
      endsAt: endsAt || undefined,
      notificar,
    });
    setSaving(false);

    if (!res.ok) {
      setError(res.error ?? "No se pudo publicar el aviso");
      return;
    }

    setOk(
      res.avisados
        ? `Publicado. Le sonó el teléfono a ${res.avisados} ${res.avisados === 1 ? "dispositivo" : "dispositivos"}.`
        : "Publicado. Nadie tiene la app instalada todavía, pero queda a la vista en el portal."
    );
    router.refresh();
    setTimeout(() => setOpen(false), 2200);
  }

  return (
    <>
      <button
        onClick={abrir}
        style={{
          background: "var(--px-ink)", color: "var(--px-bone)", border: "none",
          borderRadius: 8, padding: "9px 14px", fontSize: 13, fontWeight: 600,
          whiteSpace: "nowrap", flexShrink: 0,
          fontFamily: "var(--font-inter-tight), Inter, system-ui, sans-serif",
          cursor: "pointer",
        }}
      >
        Publicar aviso
      </button>

      <Drawer open={open} onClose={() => setOpen(false)} title="Publicar aviso" subtitle="LLEGA AL TELÉFONO DE LOS RESIDENTES">
        <form onSubmit={guardar}>
          <Row>
            <label style={LABEL}>Tipo *</label>
            <select value={kind} onChange={(e) => setKind(e.target.value as NoticeKind)} style={{ ...FIELD, cursor: "pointer" }}>
              {NOTICE_KINDS.map((k) => (
                <option key={k} value={k}>{NOTICE_LABEL[k]}</option>
              ))}
            </select>
          </Row>

          <Row>
            <label style={LABEL}>¿Qué pasa? *</label>
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Corte programado por reparación de matriz"
              style={FIELD}
            />
          </Row>

          <Row>
            <label style={LABEL}>Detalle</label>
            <input
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Ej: Guarda agua en la mañana. Afecta a las torres A y B."
              style={FIELD}
            />
          </Row>

          <Row>
            <label style={LABEL}>¿A quién le toca? *</label>
            <div style={{ display: "flex", gap: 8 }}>
              {(["edificio", "unidad"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setScope(s)}
                  style={{
                    flex: 1, padding: "10px", borderRadius: 8, cursor: "pointer",
                    background: scope === s ? "var(--px-ink)" : "white",
                    color: scope === s ? "var(--px-bone)" : "var(--px-ink2)",
                    border: scope === s ? "1px solid var(--px-ink)" : "1px solid var(--px-line)",
                    font: "inherit", fontSize: 13, fontWeight: 500,
                  }}
                >
                  {s === "edificio" ? "Todo el edificio" : "Un departamento"}
                </button>
              ))}
            </div>
          </Row>

          {scope === "unidad" && (
            <Row>
              <label style={LABEL}>Departamento *</label>
              <input
                required
                list="unidades-aviso"
                value={unitCode}
                onChange={(e) => setUnitCode(e.target.value)}
                placeholder="Ej: A · 1204"
                style={FIELD}
              />
              <datalist id="unidades-aviso">
                {unidades.map((u) => <option key={u} value={u} />)}
              </datalist>
            </Row>
          )}

          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            <Row>
              <label style={LABEL}>Empieza</label>
              <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} style={FIELD} />
            </Row>
            <Row>
              <label style={LABEL}>Termina</label>
              <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} style={FIELD} />
            </Row>
          </div>

          <Row>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
              <input type="checkbox" checked={notificar} onChange={(e) => setNotificar(e.target.checked)} />
              Mandar la notificación ahora
            </label>
            <div style={{ fontSize: 11.5, color: "var(--px-mid)", marginTop: 6, lineHeight: 1.5 }}>
              Sin esto el aviso igual queda publicado en el portal y en la portería, pero
              nadie recibe nada en el teléfono.
            </div>
          </Row>

          {error && (
            <div style={{ marginBottom: 16, padding: "9px 12px", borderRadius: 8, background: "oklch(0.96 0.05 28)", color: "var(--px-alert)", fontSize: 13, border: "1px solid oklch(0.88 0.12 28)" }}>
              {error}
            </div>
          )}
          {ok && (
            <div style={{ marginBottom: 16, padding: "9px 12px", borderRadius: 8, background: "oklch(0.95 0.05 145)", color: "var(--px-ok)", fontSize: 13, border: "1px solid oklch(0.88 0.12 145)" }}>
              {ok}
            </div>
          )}

          <button type="submit" disabled={saving} style={{ ...BTN_PRIMARY, opacity: saving ? 0.6 : 1 }}>
            {saving ? "Publicando…" : "Publicar aviso"}
          </button>
        </form>
      </Drawer>
    </>
  );
}

import type { CSSProperties } from "react";
import Link from "next/link";
import InteractiveLogo from "@/components/InteractiveLogo";
import InstallApp from "@/components/InstallApp";
import { IconMark } from "@/components/icons";

// ── Shared tokens ─────────────────────────────────────────────────────────────
const INK = "#f8f6f2";
const INK_DIM = "rgba(248,246,242,0.52)";
const INK_FAINT = "rgba(248,246,242,0.28)";
const INK_GHOST = "rgba(248,246,242,0.08)";
const BORDER = "rgba(255,255,255,0.08)";
const BG = "#080808";
const MONO: CSSProperties = {
  fontFamily: "var(--font-jetbrains-mono), 'JetBrains Mono', monospace",
  fontSize: 11,
  letterSpacing: "0.1em",
  color: INK_FAINT,
};
const LABEL = (color = INK_FAINT): CSSProperties => ({
  ...MONO,
  color,
  marginBottom: 16,
  textTransform: "uppercase" as const,
});
const H2: CSSProperties = {
  fontSize: "clamp(28px, 4vw, 44px)",
  fontWeight: 700,
  letterSpacing: "-0.038em",
  lineHeight: 1.1,
  margin: "0 0 20px",
  color: INK,
};
const CARD: CSSProperties = {
  background: INK_GHOST,
  border: `1px solid ${BORDER}`,
  borderRadius: 14,
  padding: "24px 26px",
};

// ── Nav ───────────────────────────────────────────────────────────────────────
const NAV_LINK: CSSProperties = {
  textDecoration: "none",
  color: INK_DIM,
  fontSize: 14,
  letterSpacing: "-0.01em",
};

function Nav() {
  return (
    <nav
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 clamp(16px, 4vw, 40px)",
        height: 60,
        borderBottom: `1px solid ${BORDER}`,
        background: "rgba(8,8,8,0.88)",
        backdropFilter: "blur(20px)",
        gap: 24,
      }}
    >
      <span style={{ display: "flex", alignItems: "center", gap: 9, fontWeight: 700, fontSize: 17, letterSpacing: "-0.04em", color: INK, flexShrink: 0 }}>
        {/* Sobre el negro, el rojo de marca se aclara: el #E01B22 se apaga. */}
        <IconMark size={20} accent="#FF3B3B" />
        Portex
      </span>

      <div className="px-nav-links" style={{ display: "flex", gap: 28, flex: 1, justifyContent: "center" }}>
        {[
          ["#modulos", "Módulos"],
          ["#como-funciona", "Cómo funciona"],
          ["#precios", "Precios"],
        ].map(([href, label]) => (
          <a key={href} href={href} style={NAV_LINK}>{label}</a>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
        <Link href="/login" style={{ ...NAV_LINK, padding: "7px 14px", borderRadius: 8 }}>
          Acceder
        </Link>
        <Link
          href="/register"
          style={{
            fontSize: 14,
            fontWeight: 600,
            background: INK,
            color: BG,
            padding: "7px 18px",
            borderRadius: 8,
            textDecoration: "none",
            letterSpacing: "-0.02em",
          }}
        >
          Probar gratis
        </Link>
      </div>
    </nav>
  );
}

// ── Hero ──────────────────────────────────────────────────────────────────────
function Hero() {
  return (
    <section style={{ maxWidth: 900, margin: "clamp(24px, 8vw, 100px) auto", padding: "clamp(40px, 10vw, 88px) clamp(18px, 5vw, 40px) 64px", textAlign: "center" }}>
      <div
        style={{
          ...MONO,
          fontSize: 12,
          marginBottom: 28,
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          textTransform: "uppercase",
        }}
      >
        <span
          style={{
            display: "inline-block",
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "#4ade80",
            boxShadow: "0 0 8px #4ade80",
          }}
        />
        Control de acceso para condominios, edificios y empresas
      </div>

      <h1
        style={{
          fontSize: "clamp(56px, 9vw, 100px)",
          fontWeight: 700,
          letterSpacing: "-0.05em",
          lineHeight: 1.0,
          margin: "0 0 10px",
          color: INK,
        }}
      >
        Diez segundos
      </h1>
      <h1
        style={{
          fontSize: "clamp(56px, 9vw, 100px)",
          fontWeight: 700,
          letterSpacing: "-0.05em",
          lineHeight: 1.0,
          margin: "0 0 32px",
          color: INK_DIM,
        }}
      >
        por cada ingreso
      </h1>

      <p
        style={{
          fontSize: 17,
          lineHeight: 1.65,
          color: INK_DIM,
          maxWidth: 560,
          margin: "0 auto 44px",
        }}
      >
        Reemplaza el cuaderno de portería, las planillas en Excel y los chats de WhatsApp.
        Un solo sistema para visitas, vehículos, encomiendas y bitácora de turno.
      </p>

      <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginBottom: 40 }}>
        <Link
          href="/register"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            background: INK,
            color: BG,
            fontSize: 15,
            fontWeight: 600,
            padding: "13px 28px",
            borderRadius: 10,
            textDecoration: "none",
            letterSpacing: "-0.02em",
          }}
        >
          Empieza gratis →
        </Link>
        <a
          href="#como-funciona"
          style={{
            display: "inline-flex",
            alignItems: "center",
            background: "transparent",
            color: INK_DIM,
            fontSize: 15,
            fontWeight: 500,
            padding: "13px 28px",
            borderRadius: 10,
            border: `1px solid ${BORDER}`,
            textDecoration: "none",
            letterSpacing: "-0.02em",
          }}
        >
          Ver cómo funciona
        </a>
      </div>

      {/* Badges */}
      <div style={{ display: "flex", justifyContent: "center", gap: 20, flexWrap: "wrap" }}>
        {["Sin tarjeta de crédito", "Listo en 5 minutos", "Importa tu padrón"].map((t) => (
          <span
            key={t}
            style={{
              ...MONO,
              border: `1px solid ${BORDER}`,
              borderRadius: 20,
              padding: "5px 14px",
              fontSize: 11,
            }}
          >
            {t}
          </span>
        ))}
      </div>
    </section>
  );
}

// ── UI Mockup (conserje) ──────────────────────────────────────────────────────
function MockupConserje() {
  const entries = [
    { time: "14:32", type: "INGRESO", desc: "Juan Pérez · autorizó Martín Reyes", unit: "A · 1204" },
    { time: "14:28", type: "PROVEEDOR", desc: "Jorge Mendieta · jardinería", unit: "Áreas comunes" },
    { time: "14:15", type: "INGRESO", desc: "Visita · patente JLHK·52", unit: "B · 802" },
    { time: "14:02", type: "ENCOMIENDA", desc: "Chilexpress · pendiente de retiro", unit: "A · 1503" },
    { time: "13:50", type: "SALIDA", desc: "Camila Soto", unit: "" },
    { time: "13:44", type: "ENTREGA", desc: "Uber Eats · queda en portería", unit: "B · 1106" },
  ];
  const typeColor: Record<string, string> = {
    INGRESO: "#4ade80",
    PROVEEDOR: "#4ade80",
    SALIDA: "#f87171",
    ENCOMIENDA: "#60a5fa",
    ENTREGA: "#fbbf24",
  };
  const tiles = [
    { label: "Visita", hint: "Persona, conductor", primary: true },
    { label: "Entrega", hint: "Delivery, encomienda" },
    { label: "Proveedor", hint: "Mantención, obra" },
  ];
  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "0 clamp(18px, 5vw, 40px) 80px" }}>
      <div
        style={{
          border: `1px solid rgba(255,255,255,0.12)`,
          borderRadius: 16,
          overflow: "hidden",
          background: "rgba(255,255,255,0.02)",
        }}
      >
        {/* Window bar */}
        <div
          style={{
            borderBottom: `1px solid ${BORDER}`,
            padding: "12px 20px",
            display: "flex",
            alignItems: "center",
            gap: 12,
            background: "rgba(0,0,0,0.3)",
          }}
        >
          <div style={{ display: "flex", gap: 6 }}>
            {["#f87171", "#fbbf24", "#4ade80"].map((c) => (
              <div key={c} style={{ width: 10, height: 10, borderRadius: "50%", background: c }} />
            ))}
          </div>
          <span style={{ ...MONO, fontSize: 11 }}>portex.app/conserje</span>
          <span style={{ ...MONO, fontSize: 10, marginLeft: "auto" }}>Mirador del Parque · TURNO 14:00 · Rodrigo Espinoza</span>
        </div>

        {/* Tiles: lo que el conserje ve al llegar al turno */}
        <div style={{ padding: "20px", borderBottom: `1px solid ${BORDER}` }}>
          <div className="px-grid" style={{ "--cols": "repeat(3, 1fr)", "--gap": "10px", "--cols-movil": "1fr" } as CSSProperties}>
            {tiles.map((t) => (
              <div
                key={t.label}
                style={{
                  border: `1px solid ${t.primary ? "rgba(255,255,255,0.22)" : BORDER}`,
                  background: t.primary ? "rgba(255,255,255,0.06)" : "transparent",
                  borderRadius: 12,
                  padding: "18px 16px",
                }}
              >
                <div
                  style={{
                    fontSize: 17,
                    fontWeight: 600,
                    letterSpacing: "-0.03em",
                    color: t.primary ? INK : INK_DIM,
                    marginBottom: 4,
                  }}
                >
                  {t.label}
                </div>
                <div style={{ ...MONO, fontSize: 10 }}>{t.hint.toUpperCase()}</div>
              </div>
            ))}
          </div>
          <div
            style={{
              marginTop: 10,
              border: `1px solid rgba(248,113,113,0.25)`,
              borderRadius: 12,
              padding: "14px 16px",
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
            }}
          >
            <span style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.03em", color: INK_DIM }}>
              Salida
            </span>
            <span style={{ ...MONO, fontSize: 10 }}>7 PERSONAS ADENTRO</span>
          </div>
        </div>

        {/* Log */}
        <div style={{ padding: "8px 0" }}>
          {entries.map((e, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "10px 20px",
                borderBottom: i < entries.length - 1 ? `1px solid rgba(255,255,255,0.04)` : undefined,
              }}
            >
              <span style={{ ...MONO, fontSize: 12, color: INK_FAINT, flexShrink: 0, width: 34 }}>{e.time}</span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  color: typeColor[e.type] ?? INK_FAINT,
                  flexShrink: 0,
                  width: 84,
                  fontFamily: "var(--font-jetbrains-mono), monospace",
                }}
              >
                {e.type}
              </span>
              <span style={{ fontSize: 13, color: INK_DIM, flex: 1, letterSpacing: "-0.01em" }}>{e.desc}</span>
              {e.unit && (
                <span style={{ ...MONO, fontSize: 10, color: INK_FAINT, flexShrink: 0 }}>{e.unit}</span>
              )}
            </div>
          ))}
        </div>
        {/* Footer note */}
        <div style={{ padding: "14px 20px", borderTop: `1px solid ${BORDER}`, ...MONO, fontSize: 11 }}>
          Cada ingreso queda con su RUT, su hora y quién lo autorizó
        </div>
      </div>
    </div>
  );
}

// ── Problema ──────────────────────────────────────────────────────────────────
function Problema() {
  const items = [
    {
      icon: "📖",
      title: "Cuadernos físicos",
      desc: "Letras ilegibles, hojas perdidas, sin búsqueda histórica.",
    },
    {
      icon: "💬",
      title: "Excel y WhatsApp",
      desc: "Información dispersa entre el grupo, la nube y el escritorio.",
    },
    {
      icon: "🖥️",
      title: "Sistemas antiguos",
      desc: "Cargan lento, requieren capacitar a cada nuevo conserje.",
    },
    {
      icon: "🔍",
      title: "Sin trazabilidad",
      desc: "Cuando pasa algo, nadie puede reconstruir qué ocurrió a qué hora.",
    },
  ];
  return (
    <section style={{ maxWidth: 1040, margin: "0 auto", padding: "16px clamp(18px, 5vw, 40px) 80px" }}>
      <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 64 }}>
        <div style={LABEL()}>El problema</div>
        <h2 style={{ ...H2, maxWidth: 520 }}>
          Los conserjes anotan a mano.<br />
          Los administradores rastrean en planillas.
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: 12,
            marginTop: 40,
          }}
        >
          {items.map((item) => (
            <div key={item.title} style={CARD}>
              <div style={{ fontSize: 24, marginBottom: 12 }}>{item.icon}</div>
              <div
                style={{ fontWeight: 600, fontSize: 14, marginBottom: 8, letterSpacing: "-0.02em", color: INK }}
              >
                {item.title}
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.6, color: INK_DIM }}>{item.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Cómo funciona ─────────────────────────────────────────────────────────────
function ComoFunciona() {
  const surfaces = [
    {
      tag: "SUPERFICIE / CONSERJE",
      title: "“Su RUT, por favor”.",
      desc: "Cuatro botones grandes y un campo. El RUT es la identidad: si la persona ya vino antes, aparece su nombre y el departamento al que va. Un toque y entra.",
      bullets: [
        "Reconoce al visitante frecuente por su RUT",
        "Avisa al departamento y espera la respuesta",
        "Encomiendas pendientes y quién las retiró",
      ],
    },
    {
      tag: "SUPERFICIE / ADMINISTRADOR",
      title: "Mira el edificio en una pantalla.",
      desc: "Movimiento del día, padrón completo, turnos del personal y la bitácora entera. Una vista, todo el edificio.",
      bullets: [
        "Padrón importado desde Excel",
        "Turnos del personal con horas y costo",
        "Bitácora con quién autorizó cada ingreso",
      ],
    },
    {
      tag: "SUPERFICIE / RESIDENTE",
      title: "Autoriza desde el sillón.",
      desc: "Anuncia a quien te viene a ver antes de que llegue, o decide desde el teléfono cuando alguien toca sin aviso. Se instala como app.",
      bullets: [
        "Anuncia visitas con nombre, RUT y nota",
        "Notificación al teléfono cuando alguien llega",
        "Apruebas o rechazas y el ingreso se escribe solo",
      ],
    },
  ];
  return (
    <section id="como-funciona" style={{ maxWidth: 1040, margin: "0 auto", padding: "0 clamp(18px, 5vw, 40px) 80px" }}>
      <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 64 }}>
        <div style={LABEL()}>Cómo funciona</div>
        <h2 style={{ ...H2, maxWidth: 600 }}>
          Tres superficies,<br />una sola fuente de verdad.
        </h2>
        <p style={{ fontSize: 15, color: INK_DIM, lineHeight: 1.65, maxWidth: 560, margin: "0 0 48px" }}>
          Conserje, administrador y residente trabajan sobre los mismos datos en tiempo real.
          Sin sincronizaciones, sin Excel intermedio.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {surfaces.map((s) => (
            <div
              key={s.tag}
              className="px-grid"
              style={{
                ...CARD,
                "--cols": "1fr 1fr",
                "--gap": "32px",
                padding: "clamp(22px, 5vw, 32px) clamp(20px, 5vw, 36px)",
              } as CSSProperties}
            >
              <div>
                <div style={LABEL()}>{s.tag}</div>
                <div
                  style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.03em", color: INK, marginBottom: 12 }}
                >
                  {s.title}
                </div>
                <p style={{ fontSize: 14, color: INK_DIM, lineHeight: 1.65, margin: 0 }}>{s.desc}</p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 10 }}>
                {s.bullets.map((b) => (
                  <div key={b} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <span style={{ color: "#4ade80", flexShrink: 0, marginTop: 1 }}>✓</span>
                    <span style={{ fontSize: 13, color: INK_DIM, lineHeight: 1.5 }}>{b}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Módulos ───────────────────────────────────────────────────────────────────
function Modulos() {
  const active = [
    { title: "Control de acceso", desc: "Visitas, entregas, proveedores, salidas y bitácora." },
    { title: "Citófono digital", desc: "Aviso al departamento y autorización desde el teléfono." },
    { title: "Padrón de residentes", desc: "Multi-torre, integrantes del hogar, importado de Excel." },
    { title: "Turnos del personal", desc: "Calendario, horas trabajadas y costo estimado." },
    { title: "Encomiendas", desc: "Pendientes de retiro y registro de quién las retiró." },
    { title: "Reportes", desc: "Movimiento del edificio con filtros por tipo y fecha." },
    { title: "Estacionamientos", desc: "De residente y de visita, con estado ocupado o libre." },
    { title: "Pase con QR", desc: "El residente lo manda a su visita y en portería se escanea o se dicta." },
    { title: "Asistencia del personal", desc: "Jardinero, aseo y mantención marcan con su RUT; horas y atrasos." },
  ];
  const roadmap = [
    { eta: "EN EL PLAN", title: "Multi-edificio", desc: "Varias comunidades desde una sola cuenta." },
    { eta: "EN EL PLAN", title: "Aseo y mantención", desc: "Pauta semanal, checklists, evidencia." },
  ];
  return (
    <section id="modulos" style={{ maxWidth: 1040, margin: "0 auto", padding: "0 clamp(18px, 5vw, 40px) 80px" }}>
      <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 64 }}>
        <div style={LABEL()}>Un sistema que crece contigo</div>
        <h2 style={{ ...H2 }}>
          Empiezas con accesos.<br />
          Terminas operando todo el condominio.
        </h2>
        <p style={{ fontSize: 15, color: INK_DIM, lineHeight: 1.65, maxWidth: 560, margin: "0 0 48px" }}>
          Los módulos comparten residentes, personal y datos — instala lo que necesites cuando lo necesites.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
          {active.map((m) => (
            <div key={m.title} style={{ ...CARD, borderColor: "rgba(74,222,128,0.15)" }}>
              <div
                style={{
                  ...MONO,
                  fontSize: 10,
                  color: "#4ade80",
                  marginBottom: 12,
                  background: "rgba(74,222,128,0.08)",
                  display: "inline-block",
                  padding: "3px 10px",
                  borderRadius: 20,
                }}
              >
                EN OPERACIÓN
              </div>
              <div style={{ fontWeight: 600, fontSize: 14, letterSpacing: "-0.02em", color: INK, marginBottom: 6 }}>
                {m.title}
              </div>
              <div style={{ fontSize: 13, color: INK_DIM, lineHeight: 1.55 }}>{m.desc}</div>
            </div>
          ))}
          {roadmap.map((m) => (
            <div key={m.title} style={{ ...CARD, opacity: 0.6 }}>
              <div style={{ ...MONO, fontSize: 10, marginBottom: 12 }}>{m.eta}</div>
              <div style={{ fontWeight: 600, fontSize: 14, letterSpacing: "-0.02em", color: INK, marginBottom: 6 }}>
                {m.title}
              </div>
              <div style={{ fontSize: 13, color: INK_DIM, lineHeight: 1.55 }}>{m.desc}</div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 20, textAlign: "center" }}>
          <a
            href="mailto:portex@teolabs.app"
            style={{ ...MONO, fontSize: 12, color: INK_DIM, textDecoration: "underline", cursor: "pointer" }}
          >
            ¿Falta un módulo para tu edificio? Cuéntanos →
          </a>
        </div>
      </div>
    </section>
  );
}

// ── Garantías ─────────────────────────────────────────────────────────────────
// Acá iban un testimonio y unas métricas que nadie midió. Portex todavía no
// tiene clientes de los que presumir, y decirlo de frente vale más que inventar
// un "−84%": el edificio que se suma ahora sabe exactamente dónde se está
// metiendo.
function Garantias() {
  const puntos = [
    {
      titulo: "Funcionando esta misma noche",
      desc: "No hay instalación ni visita técnica. Creas la cuenta, cargas el padrón desde tu Excel y el turno de la noche ya registra con la tablet que tienes en portería.",
    },
    {
      titulo: "Hablas con quien lo construye",
      desc: "No hay mesa de ayuda ni tickets. Escribes a portex@teolabs.app y responde la persona que escribió el código.",
    },
    {
      titulo: "Tus datos son tuyos",
      desc: "El padrón y la bitácora se exportan cuando quieras, en un archivo que abre Excel. Sin contratos de permanencia ni multas por irse.",
    },
  ];
  return (
    <section style={{ maxWidth: 1040, margin: "0 auto", padding: "0 clamp(18px, 5vw, 40px) 80px" }}>
      <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 64 }}>
        <div style={LABEL("#4ade80")}>Cómo trabajamos</div>
        <h2 style={{ ...H2, maxWidth: 640 }}>
          Se instala en una tarde.<br />Se entiende en cinco minutos.
        </h2>
        <p style={{ fontSize: 15, color: INK_DIM, lineHeight: 1.65, maxWidth: 560, margin: "0 0 40px" }}>
          Portex lo usa gente que no eligió trabajar con computadores: el conserje del turno de
          noche, la señora del aseo, el residente de 78 años. Por eso cada pantalla hace una sola
          cosa y se resuelve con un toque.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
          {puntos.map((p) => (
            <div key={p.titulo} style={CARD}>
              <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-0.02em", color: INK, marginBottom: 8 }}>
                {p.titulo}
              </div>
              <div style={{ fontSize: 13.5, color: INK_DIM, lineHeight: 1.6 }}>{p.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Precios ───────────────────────────────────────────────────────────────────
function Precios() {
  const plans = [
    {
      name: "Esencial",
      sub: "HASTA 80 UNIDADES",
      price: "49.900",
      note: "CLP/mes · factura mensual",
      desc: "Para edificios chicos. Control de acceso completo con app de residentes incluida.",
      features: [
        "Conserjes y residentes sin límite",
        "Citófono digital con aviso al teléfono",
        "Bitácora, encomiendas y reportes",
        "Soporte por correo",
      ],
      cta: "Empezar gratis",
      href: "/register",
      highlight: false,
    },
    {
      name: "Profesional",
      sub: "81–300 UNIDADES",
      price: "129.900",
      note: "CLP/mes · factura mensual",
      desc: "Para condominios medianos con varias torres y administración activa.",
      features: [
        "Todo lo del plan Esencial",
        "Multi-torre en un mismo condominio",
        "Padrón importado desde Excel",
        "Turnos del personal con horas y costo",
      ],
      cta: "Empezar gratis",
      href: "/register",
      highlight: true,
    },
    {
      name: "Inmobiliaria",
      sub: "3+ EDIFICIOS",
      price: "A medida",
      note: "Precio por edificio",
      desc: "Para inmobiliarias y administradoras que gestionan varios condominios. Conversemos cómo opera tu equipo.",
      features: [
        "Precio por volumen de edificios",
        "Puesta en marcha acompañada",
        "Prioridad en el roadmap del producto",
        "Panel multi-edificio: en desarrollo",
      ],
      cta: "Agendar llamada",
      href: "mailto:portex@teolabs.app",
      highlight: false,
    },
  ];
  return (
    <section id="precios" style={{ maxWidth: 1040, margin: "0 auto", padding: "0 clamp(18px, 5vw, 40px) 80px" }}>
      <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 64 }}>
        <div style={LABEL()}>Planes</div>
        <h2 style={{ ...H2 }}>
          Precio por edificio,<br />no por usuario.
        </h2>
        <p style={{ fontSize: 15, color: INK_DIM, lineHeight: 1.65, maxWidth: 520, margin: "0 0 20px" }}>
          Todos los planes incluyen la app de residentes, el citófono digital, la bitácora completa
          y soporte en español.
        </p>
        <div
          style={{
            ...CARD,
            borderColor: "rgba(74,222,128,0.2)",
            padding: "16px 20px",
            marginBottom: 48,
            fontSize: 14,
            color: INK_DIM,
            lineHeight: 1.6,
          }}
        >
          <span style={{ color: "#4ade80", fontWeight: 600 }}>Los primeros 30 días van por nuestra cuenta.</span>{" "}
          Sin tarjeta para empezar y sin permanencia: si al mes no te sirve, exportas tus datos y
          cierras la cuenta.
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
          {plans.map((p) => (
            <div
              key={p.name}
              style={{
                ...CARD,
                padding: "28px 28px 32px",
                border: p.highlight ? "1px solid rgba(255,255,255,0.22)" : `1px solid ${BORDER}`,
                position: "relative",
              }}
            >
              {p.highlight && (
                <div
                  style={{
                    position: "absolute",
                    top: -11,
                    left: "50%",
                    transform: "translateX(-50%)",
                    background: INK,
                    color: BG,
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    padding: "4px 14px",
                    borderRadius: 20,
                    fontFamily: "var(--font-jetbrains-mono), monospace",
                  }}
                >
                  MÁS POPULAR
                </div>
              )}
              <div style={LABEL()}>{p.sub}</div>
              <div style={{ fontWeight: 700, fontSize: 20, letterSpacing: "-0.03em", color: INK, marginBottom: 4 }}>
                {p.name}
              </div>
              <div style={{ marginBottom: 16 }}>
                <span
                  style={{
                    fontFamily: "var(--font-jetbrains-mono), monospace",
                    fontSize: p.price === "A medida" ? 28 : 36,
                    fontWeight: 700,
                    letterSpacing: "-0.04em",
                    color: INK,
                  }}
                >
                  {p.price !== "A medida" ? "$" : ""}{p.price}
                </span>
                {p.price !== "A medida" && (
                  <span style={{ fontSize: 12, color: INK_FAINT, marginLeft: 8 }}>{p.note}</span>
                )}
              </div>
              <p style={{ fontSize: 13, color: INK_DIM, lineHeight: 1.6, marginBottom: 20 }}>{p.desc}</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
                {p.features.map((f) => (
                  <div key={f} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <span style={{ color: "#4ade80", flexShrink: 0 }}>✓</span>
                    <span style={{ fontSize: 13, color: INK_DIM }}>{f}</span>
                  </div>
                ))}
              </div>
              <Link
                href={p.href}
                style={{
                  display: "block",
                  textAlign: "center",
                  padding: "11px",
                  background: p.highlight ? INK : "transparent",
                  color: p.highlight ? BG : INK_DIM,
                  border: p.highlight ? "none" : `1px solid ${BORDER}`,
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 600,
                  textDecoration: "none",
                  letterSpacing: "-0.02em",
                }}
              >
                {p.cta} →
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── FAQ ───────────────────────────────────────────────────────────────────────
function FAQ() {
  const items = [
    {
      q: "¿Cuánto tarda en estar listo el sistema?",
      a: "Una tarde. Creas la cuenta, subes el padrón desde Excel, invitas a los conserjes por correo y ya se puede registrar. Si prefieres que te acompañemos en la puesta en marcha, escríbenos y lo hacemos contigo.",
    },
    {
      q: "¿Necesito comprar hardware o tablets?",
      a: "No. Portex funciona desde cualquier navegador: sirve la tablet que ya tienen en portería o cualquier PC. La app del residente es una web instalable (PWA) — se agrega a la pantalla de inicio del teléfono sin pasar por la tienda de aplicaciones.",
    },
    {
      q: "¿Cómo se entrena al conserje nuevo?",
      a: "La pantalla de portería son cuatro botones grandes: Visita, Entrega, Proveedor y Salida. El flujo empieza pidiendo el RUT, y si la persona ya vino antes aparece su nombre y el departamento al que va. En la práctica se explica en cinco minutos.",
    },
    {
      q: "¿Y si se cae internet en la portería?",
      a: "Portex necesita conexión: si se corta, el conserje anota en papel y registra cuando vuelve. No te vamos a decir que funciona offline porque hoy no funciona. Es de las primeras cosas que queremos resolver.",
    },
    {
      q: "¿Dónde se almacena la información?",
      a: "En Supabase, sobre infraestructura de Amazon Web Services, con cifrado en tránsito y en reposo. La separación entre edificios se impone en la propia base de datos: sin sesión iniciada no se lee nada. Tratamos los datos conforme a la Ley 19.628 y nos estamos adecuando a la Ley 21.719.",
    },
    {
      q: "¿Quién puede ver los datos de las visitas?",
      a: "El conserje ve la portería de su edificio y el administrador ve el edificio completo. El residente ve solo lo suyo: sus visitas anunciadas y las solicitudes de ingreso a su departamento — no ve el padrón ni los datos de sus vecinos. Está todo detallado en la política de privacidad.",
    },
    {
      q: "¿Puedo gestionar más de un edificio desde la misma cuenta?",
      a: "Todavía no. Hoy cada cuenta administra un edificio y el panel multi-edificio está en desarrollo. Si administras varios, escríbenos: se puede operar con una cuenta por edificio mientras tanto.",
    },
  ];
  return (
    <section style={{ maxWidth: 720, margin: "0 auto", padding: "0 clamp(18px, 5vw, 40px) 80px" }}>
      <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 64 }}>
        <div style={LABEL()}>Preguntas frecuentes</div>
        <h2 style={{ ...H2, marginBottom: 40 }}>¿Quedan dudas?</h2>

        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {items.map((item, i) => (
            <details
              key={i}
              style={{
                borderTop: `1px solid ${BORDER}`,
                ...(i === items.length - 1 ? { borderBottom: `1px solid ${BORDER}` } : {}),
              }}
            >
              <summary
                style={{
                  padding: "18px 0",
                  fontSize: 15,
                  fontWeight: 500,
                  letterSpacing: "-0.02em",
                  color: INK,
                  cursor: "pointer",
                  listStyle: "none",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                {item.q}
                <span style={{ color: INK_FAINT, flexShrink: 0, marginLeft: 16, fontSize: 18 }}>+</span>
              </summary>
              <p style={{ fontSize: 14, color: INK_DIM, lineHeight: 1.7, margin: "0 0 20px", paddingRight: 24 }}>
                {item.a}
              </p>
            </details>
          ))}
        </div>

        <p style={{ marginTop: 32, fontSize: 14, color: INK_DIM, textAlign: "center" }}>
          ¿Más preguntas? Escríbenos a{" "}
          <a href="mailto:portex@teolabs.app" style={{ color: INK, textDecoration: "underline" }}>
            portex@teolabs.app
          </a>
        </p>
      </div>
    </section>
  );
}

// ── Accesos ───────────────────────────────────────────────────────────────────
// Tres personas usan Portex y cada una ve algo distinto. La sección existe
// para dejar claro que eso NO son tres sitios: se entra por el mismo lugar
// y el sistema reconoce quién eres.
function Accesos() {
  const perfiles = [
    {
      rol: "Conserje",
      pantalla: "Portería",
      desc: "Pide el RUT, el sistema reconoce a quien ya vino antes y avisa al departamento. Pensada para tablet, con botones grandes.",
    },
    {
      rol: "Administrador",
      pantalla: "Panel de control",
      desc: "Padrón de residentes, turnos del personal, encomiendas y la bitácora completa con quién autorizó cada ingreso.",
    },
    {
      rol: "Residente",
      pantalla: "Mi departamento",
      desc: "Anuncia a quien lo viene a ver y autoriza desde el teléfono a quien llega sin aviso. Se instala como app.",
    },
  ];

  return (
    <section style={{ maxWidth: 1040, margin: "0 auto", padding: "0 clamp(18px, 5vw, 40px) 80px" }}>
      <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 64 }}>
        <div style={LABEL()}>Un solo acceso</div>
        <h2 style={H2}>
          Cada persona entra con su correo<br />y llega directo a lo suyo
        </h2>
        <p style={{ fontSize: 16, color: INK_DIM, margin: "0 0 40px", maxWidth: 620 }}>
          No hay tres direcciones que recordar ni una clave del edificio que circule por WhatsApp.
          Se entra por el mismo lugar y Portex reconoce el rol de cada cuenta.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
          {perfiles.map((p) => (
            <div key={p.rol} style={CARD}>
              <div style={{ ...MONO, marginBottom: 14 }}>{p.rol.toUpperCase()}</div>
              <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.03em", color: INK, marginBottom: 8 }}>
                {p.pantalla}
              </div>
              <p style={{ fontSize: 13.5, color: INK_DIM, lineHeight: 1.6, margin: 0 }}>{p.desc}</p>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 28 }}>
          <Link
            href="/login"
            style={{
              display: "inline-flex",
              alignItems: "center",
              background: INK,
              color: BG,
              fontSize: 15,
              fontWeight: 600,
              padding: "13px 28px",
              borderRadius: 10,
              textDecoration: "none",
              letterSpacing: "-0.02em",
            }}
          >
            Entrar a mi cuenta →
          </Link>
        </div>
      </div>
    </section>
  );
}

// ── CTA final ─────────────────────────────────────────────────────────────────
function CTAFinal() {
  return (
    <section
      style={{
        borderTop: `1px solid ${BORDER}`,
        padding: "88px 40px",
        textAlign: "center",
      }}
    >
      <div style={LABEL()}>Última invitación</div>
      <h2
        style={{
          fontSize: "clamp(32px, 5vw, 60px)",
          fontWeight: 700,
          letterSpacing: "-0.045em",
          lineHeight: 1.05,
          margin: "0 0 24px",
          color: INK,
        }}
      >
        Tu conserje ya merece<br />una mejor herramienta
      </h2>
      <p style={{ fontSize: 16, color: INK_DIM, margin: "0 0 40px" }}>
        Sin instalaciones. Sin contratos. Los primeros 30 días, gratis.
      </p>
      <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
        <Link
          href="/register"
          style={{
            display: "inline-flex",
            alignItems: "center",
            background: INK,
            color: BG,
            fontSize: 15,
            fontWeight: 600,
            padding: "14px 32px",
            borderRadius: 10,
            textDecoration: "none",
            letterSpacing: "-0.02em",
          }}
        >
          Crear cuenta gratis →
        </Link>
        <a
          href="mailto:portex@teolabs.app"
          style={{
            display: "inline-flex",
            alignItems: "center",
            background: "transparent",
            color: INK_DIM,
            fontSize: 15,
            fontWeight: 500,
            padding: "14px 32px",
            borderRadius: 10,
            border: `1px solid ${BORDER}`,
            textDecoration: "none",
            letterSpacing: "-0.02em",
          }}
        >
          Hablar con ventas
        </a>
      </div>
    </section>
  );
}

// ── Footer ────────────────────────────────────────────────────────────────────
function Footer() {
  // Solo links que llevan a alguna parte: un footer lleno de href="#" es la
  // primera señal de que el sitio promete más de lo que hay.
  const cols: { title: string; links: [string, string][] }[] = [
    {
      title: "Producto",
      links: [
        ["#como-funciona", "Cómo funciona"],
        ["#modulos", "Módulos"],
        ["#precios", "Precios"],
      ],
    },
    {
      title: "Cuenta",
      links: [
        ["/login", "Acceder"],
        ["/register", "Crear cuenta"],
      ],
    },
    {
      title: "Legal",
      links: [
        ["/terminos", "Términos"],
        ["/privacidad", "Privacidad"],
      ],
    },
    {
      title: "Contacto",
      links: [["mailto:portex@teolabs.app", "portex@teolabs.app"]],
    },
  ];
  return (
    <footer
      style={{
        borderTop: `1px solid ${BORDER}`,
        padding: "56px clamp(18px, 5vw, 40px) 40px",
      }}
    >
      <div style={{ maxWidth: 1040, margin: "0 auto" }}>
        {/* Top row */}
        <div
          className="px-grid"
          style={{
            "--cols": "200px repeat(4, 1fr)",
            "--cols-tablet": "repeat(3, 1fr)",
            "--cols-movil": "repeat(2, 1fr)",
            "--gap": "24px",
            marginBottom: 56,
          } as CSSProperties}
        >
          {/* Brand */}
          <div>
            <div style={{ fontWeight: 700, fontSize: 18, letterSpacing: "-0.04em", color: INK, marginBottom: 10 }}>
              Portex
            </div>
            <div style={{ fontSize: 12, color: INK_FAINT, lineHeight: 1.6 }}>
              Control de acceso y operaciones para condominios.
              <br />Hecho en Santiago, Chile.
            </div>
          </div>

          {/* Link columns */}
          {cols.map((col) => (
            <div key={col.title}>
              <div style={{ ...MONO, marginBottom: 16 }}>{col.title.toUpperCase()}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {col.links.map(([href, label]) => (
                  <a
                    key={href}
                    href={href}
                    style={{ fontSize: 13, color: INK_FAINT, textDecoration: "none", letterSpacing: "-0.01em" }}
                  >
                    {label}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Bottom row */}
        <div
          style={{
            borderTop: `1px solid ${BORDER}`,
            paddingTop: 24,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <span style={{ ...MONO, fontSize: 11 }}>
            © 2026 PORTEX · UN PRODUCTO DE TEO LABS · SANTIAGO, CHILE
          </span>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 14,
              color: INK_FAINT,
            }}
          >
            Desarrollado por
            <a
              href="https://www.teolabs.app"
              target="_blank"
              rel="noopener noreferrer"
              style={{ textDecoration: "none" }}
            >
              <InteractiveLogo variant="footer-small" className="text-[14px]" />
            </a>
            ®
          </span>
        </div>
      </div>
    </footer>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  return (
    <div
      style={{
        background: BG,
        color: INK,
        minHeight: "100dvh",
        fontFamily: "var(--font-inter-tight), Inter, system-ui, sans-serif",
        letterSpacing: "-0.005em",
      }}
    >
      <Nav />
      <Hero />
      <MockupConserje />
      <Problema />
      <ComoFunciona />
      <Modulos />
      <Accesos />
      <Garantias />
      <Precios />
      <FAQ />
      <CTAFinal />
      <Footer />
      <InstallApp />
    </div>
  );
}

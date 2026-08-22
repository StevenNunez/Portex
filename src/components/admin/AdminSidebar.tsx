"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";
import { IconMark } from "@/components/icons";
import { createSupabaseBrowser } from "@/lib/supabase-browser";

const NAV = [
  { section: "OPERACIÓN" },
  { id: "resumen",     href: "/admin",              label: "Resumen",          hint: "Hoy" },
  { id: "encomiendas", href: "/admin/encomiendas",  label: "Encomiendas",      hint: "" },
  { id: "vehiculos",   href: "/admin/vehiculos",    label: "Vehículos",        hint: "" },
  { id: "parking",     href: "/admin/estacionamientos", label: "Estacionamientos", hint: "" },
  { id: "visitantes",  href: "/admin/visitantes",   label: "Visitantes frec.", hint: "" },
  { id: "avisos",      href: "/admin/avisos",      label: "Avisos",           hint: "" },

  { section: "PERSONAS" },
  { id: "residentes",  href: "/admin/residentes",   label: "Residentes",       hint: "" },
  { id: "personal",    href: "/admin/personal",     label: "Personal",         hint: "" },
  { id: "turnos",      href: "/admin/turnos",       label: "Turnos",           hint: "" },
  { id: "asistencia",  href: "/admin/asistencia",   label: "Asistencia",       hint: "" },
  { id: "jardineria",  label: "Jardinería",   soon: true },
  { id: "limpieza",    label: "Limpieza",     soon: true },

  { section: "AJUSTES" },
  { id: "reportes",    href: "/admin/reportes",     label: "Reportes" },
  { id: "config",      href: "/admin/config",       label: "Configuración" },
] as const;

interface Props {
  buildingName: string | null;
  unitsTotal: number | null;
  staffName: string;
  role: string;
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("");
}

function roleLabel(role: string) {
  const labels: Record<string, string> = {
    admin: "Administrador",
    conserje: "Conserje",
    residente: "Residente",
  };
  return labels[role] ?? role;
}

export default function AdminSidebar({ buildingName, unitsTotal, staffName, role }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  // En el teléfono la barra lateral es un cajón. Se abre desde la barra de
  // arriba y se cierra sola al entrar a una sección: si no, uno toca
  // "Encomiendas" y se queda mirando el mismo menú encima de la página.
  const [abierto, setAbierto] = useState(false);

  // Con el cajón abierto, el fondo no debe correrse bajo el dedo.
  useEffect(() => {
    if (!abierto) return;
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previo;
    };
  }, [abierto]);

  function isActive(href?: string) {
    if (!href) return false;
    if (href === "/admin") return pathname === "/admin";
    return pathname.startsWith(href);
  }

  async function handleSignOut() {
    const supabase = createSupabaseBrowser();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const displayName = buildingName ?? "Sin edificio";
  const displayInitials = buildingName ? initials(buildingName) : "—";

  return (
    <>
      {/* Barra de arriba: solo existe bajo los 900px (lo decide globals.css) */}
      <div className="px-topbar">
        <button
          onClick={() => setAbierto(true)}
          aria-label="Abrir menú"
          aria-expanded={abierto}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: 38, height: 38, marginLeft: -6, borderRadius: 8,
            background: "none", border: "none", cursor: "pointer",
            color: "var(--px-ink)", flexShrink: 0,
          }}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M3 5.5h14M3 10h14M3 14.5h14" />
          </svg>
        </button>
        <IconMark size={17} />
        <span style={{ fontWeight: 600, fontSize: 15, letterSpacing: "-0.02em" }}>Portex</span>
        <span
          style={{
            fontFamily: "var(--font-jetbrains-mono)", fontSize: 10,
            color: "var(--px-mid)", flex: 1, minWidth: 0,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            textAlign: "right",
          }}
        >
          {displayName}
        </span>
      </div>

      <div
        className="px-sidebar-backdrop"
        data-abierto={abierto ? "si" : "no"}
        onClick={() => setAbierto(false)}
        aria-hidden
      />

    <aside
      className="px-sidebar"
      data-abierto={abierto ? "si" : "no"}
      // La posición vive en globals.css: en escritorio se queda pegada al
      // costado, en el teléfono es un cajón. Un `position` inline acá le
      // ganaría a la media query.
      style={{
        width: 232, flexShrink: 0,
        background: "white", borderRight: "1px solid var(--px-line)",
        display: "flex", flexDirection: "column",
      }}
    >
      {/* Logo */}
      <div style={{ padding: "22px 20px 18px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <IconMark size={18} />
          <span style={{ fontWeight: 600, fontSize: 16, letterSpacing: "-0.02em" }}>Portex</span>
          <span style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 10, color: "var(--px-mid)", marginLeft: 4 }}>
            /ADMIN
          </span>
        </div>
      </div>

      {/* Building card */}
      <div style={{ padding: "0 14px 14px" }}>
        <div
          style={{
            background: "var(--px-paper)", border: "1px solid var(--px-line)",
            borderRadius: 8, padding: "10px 12px",
            display: "flex", alignItems: "center", gap: 10,
          }}
        >
          <div
            style={{
              width: 32, height: 32, borderRadius: 6, flexShrink: 0,
              background: "var(--px-ink)", color: "var(--px-bone)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, fontWeight: 700, fontFamily: "var(--font-jetbrains-mono)",
              letterSpacing: "0.04em",
            }}
          >
            {displayInitials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 12.5, fontWeight: 500,
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}
            >
              {displayName}
            </div>
            <div style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 10, color: "var(--px-mid)", marginTop: 1 }}>
              {unitsTotal != null ? `${unitsTotal.toLocaleString("es-CL")} unidades` : "Configurando…"}
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav
        style={{
          padding: "0 12px 14px", display: "flex", flexDirection: "column",
          gap: 2, flex: 1, overflow: "auto",
        }}
      >
        {NAV.map((n, i) => {
          if ("section" in n) {
            return (
              <div
                key={"s" + i}
                style={{
                  fontFamily: "var(--font-jetbrains-mono)", fontSize: 9.5,
                  letterSpacing: "0.1em", color: "var(--px-mid2)",
                  padding: i === 0 ? "4px 12px 6px" : "14px 12px 6px",
                }}
              >
                {n.section}
              </div>
            );
          }

          const soon = "soon" in n && n.soon;
          const active = isActive("href" in n ? n.href : undefined);

          if (soon || !("href" in n)) {
            return (
              <div
                key={n.id}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "7px 12px", borderRadius: 7,
                  color: "var(--px-mid2)", fontSize: 13,
                }}
              >
                <span>{n.label}</span>
                <span
                  style={{
                    fontFamily: "var(--font-jetbrains-mono)", fontSize: 9,
                    letterSpacing: "0.08em", padding: "2px 6px", borderRadius: 4,
                    color: "var(--px-mid)", background: "var(--px-paper)",
                    border: "1px solid var(--px-line2)",
                  }}
                >
                  PRÓX.
                </span>
              </div>
            );
          }

          return (
            <Link
              key={n.id}
              href={n.href}
              onClick={() => setAbierto(false)}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "7px 12px", borderRadius: 7,
                background: active ? "var(--px-ink)" : "transparent",
                color: active ? "var(--px-bone)" : "var(--px-ink2)",
                fontSize: 13, fontWeight: active ? 500 : 400,
                textDecoration: "none",
              }}
            >
              <span>{n.label}</span>
              {"hint" in n && n.hint && (
                <span
                  style={{
                    fontFamily: "var(--font-jetbrains-mono)", fontSize: 10,
                    color: active ? "oklch(0.92 0.005 60)" : "var(--px-mid)",
                  }}
                >
                  {n.hint}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
      <div
        style={{
          padding: "14px 16px", borderTop: "1px solid var(--px-line)",
          display: "flex", alignItems: "center", gap: 10,
        }}
      >
        <div
          style={{
            width: 30, height: 30, borderRadius: 15, flexShrink: 0,
            background: "var(--px-line)", color: "var(--px-ink2)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 11, fontWeight: 600,
          }}
        >
          {initials(staffName)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 12.5, fontWeight: 500,
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}
          >
            {staffName}
          </div>
          <div style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 10, color: "var(--px-mid)" }}>
            {roleLabel(role)}
          </div>
        </div>
        <button
          onClick={handleSignOut}
          title="Cerrar sesión"
          style={{
            background: "none", border: "none", cursor: "pointer",
            color: "var(--px-mid)", padding: "4px", borderRadius: 4,
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M9 2H12.5C12.8 2 13 2.2 13 2.5V12.5C13 12.8 12.8 13 12.5 13H9" />
            <path d="M6 10.5L9 7.5L6 4.5" />
            <path d="M9 7.5H2" />
          </svg>
        </button>
      </div>
    </aside>
    </>
  );
}

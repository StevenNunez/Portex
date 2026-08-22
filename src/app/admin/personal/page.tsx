import type { CSSProperties } from "react";
import { redirect } from "next/navigation";
import { getStaff } from "@/lib/db";
import { getUserContext } from "@/lib/user-context";
import AddPersonalButton from "@/components/admin/AddPersonalButton";
import InviteStaffForm from "@/app/admin/config/InviteStaffForm";
import StaffCard from "@/components/admin/StaffCard";

/**
 * El personal del edificio.
 *
 * Estaba metido dentro de Configuración, y ahí funciona mientras sean tres
 * conserjes. Con treinta —un condominio con turnos, aseo y jardinería— la
 * página de ajustes se volvía una lista interminable en la que además vivían
 * cosas que no se tocan nunca.
 *
 * Acá cada quien tiene su ficha: cómo ubicarlo y a quién llamar si algo pasa
 * en el turno. Los datos de contacto los mantiene el propio trabajador desde
 * su pantalla de portería; el administrador ve, corrige y da de baja.
 */

export const revalidate = 0;

const MONO: CSSProperties = {
  fontFamily: "var(--font-jetbrains-mono)",
  fontSize: 11,
  color: "var(--px-mid)",
  letterSpacing: "0.08em",
};

export default async function PersonalPage() {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");
  if (ctx.role !== "admin") redirect("/inicio");
  if (!ctx.buildingId) redirect("/onboarding");

  const staff = await getStaff(ctx.buildingId);

  const conCuenta = staff.filter((s) => s.profile_id).length;
  const sinEmergencia = staff.filter((s) => !s.emergency_phone).length;

  return (
    <>
      <header className="px-head">
        <div className="px-head-fila">
          <div>
            <div style={MONO}>
              PERSONAL · {staff.length} {staff.length === 1 ? "PERSONA" : "PERSONAS"}
              {conCuenta > 0 ? ` · ${conCuenta} CON CUENTA` : ""}
              {sinEmergencia > 0 ? ` · ${sinEmergencia} SIN CONTACTO DE EMERGENCIA` : ""}
            </div>
            <h1 style={{ margin: "4px 0 0", fontWeight: 600, letterSpacing: "-0.025em" }}>
              Personal
            </h1>
          </div>
          <AddPersonalButton />
        </div>
      </header>

      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: "24px clamp(16px, 4vw, 32px)",
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        {/* Invitar: lo primero, porque es lo que hace que la ficha tenga dueño */}
        {ctx.orgId && (
          <div
            style={{
              background: "white",
              border: "1px solid var(--px-line)",
              borderRadius: 12,
              padding: "18px 20px",
            }}
          >
            <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 4 }}>
              Dar acceso a alguien del equipo
            </div>
            <p style={{ margin: "0 0 14px", fontSize: 13, color: "var(--px-mid)", lineHeight: 1.6 }}>
              Le llega un correo para crear su contraseña y entra directo a la pantalla de
              portería. Desde ahí mantiene sus propios datos de contacto.
            </p>
            <InviteStaffForm organizationId={ctx.orgId} />
          </div>
        )}

        {staff.length === 0 ? (
          <div
            style={{
              padding: "60px 20px",
              textAlign: "center",
              fontFamily: "var(--font-jetbrains-mono)",
              fontSize: 12,
              color: "var(--px-mid)",
            }}
          >
            Todavía no hay nadie en el equipo.
          </div>
        ) : (
          <div
            className="px-grid"
            style={{
              "--cols": "repeat(auto-fill, minmax(300px, 1fr))",
              "--cols-tablet": "repeat(auto-fill, minmax(260px, 1fr))",
              "--cols-movil": "1fr",
              "--gap": "12px",
            } as CSSProperties}
          >
            {staff.map((s) => (
              <StaffCard key={s.id} staff={s} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

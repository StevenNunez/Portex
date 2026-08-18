import { redirect } from "next/navigation";
import { getUserContext } from "@/lib/user-context";
import { getStaff } from "@/lib/db";
import InviteStaffForm from "./InviteStaffForm";
import StaffCard from "@/components/admin/StaffCard";

export const revalidate = 0;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "white", border: "1px solid var(--px-line)", borderRadius: 12, overflow: "hidden" }}>
      <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--px-line2)", fontSize: 13, fontWeight: 600, color: "var(--px-ink)" }}>
        {title}
      </div>
      <div style={{ padding: "20px" }}>{children}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0, paddingBottom: 14, marginBottom: 14, borderBottom: "1px solid var(--px-line2)" }}>
      <span style={{ width: 180, flexShrink: 0, fontSize: 13, color: "var(--px-mid)" }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 500, color: "var(--px-ink)" }}>{value}</span>
    </div>
  );
}


export default async function ConfigPage() {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");

  const staff = ctx.buildingId ? await getStaff(ctx.buildingId) : [];

  return (
    <>
      <header style={{ padding: "22px 32px 18px", borderBottom: "1px solid var(--px-line)", flexShrink: 0, background: "white" }}>
        <div style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 11, color: "var(--px-mid)", letterSpacing: "0.08em" }}>
          AJUSTES
        </div>
        <h1 style={{ margin: "4px 0 0", fontSize: 30, fontWeight: 600, letterSpacing: "-0.025em" }}>
          Configuración
        </h1>
      </header>

      <div style={{ flex: 1, overflow: "auto", padding: "28px 32px", display: "flex", flexDirection: "column", gap: 20, maxWidth: 780 }}>

        {/* Building info */}
        <Section title="Edificio">
          <Field label="Nombre del edificio" value={ctx.buildingName ?? "—"} />
          <Field label="Unidades totales"    value={ctx.unitsTotal != null ? String(ctx.unitsTotal) : "—"} />
          <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
            <span style={{ width: 180, flexShrink: 0, fontSize: 13, color: "var(--px-mid)" }}>Organización</span>
            <span style={{ fontSize: 13, fontWeight: 500, color: "var(--px-ink)" }}>{ctx.orgName ?? "—"}</span>
          </div>
        </Section>

        {/* My account */}
        <Section title="Mi cuenta">
          <Field label="Nombre"  value={ctx.staffName} />
          <Field label="Rol"     value={ctx.role === "admin" ? "Administrador" : ctx.role} />
          <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
            <span style={{ width: 180, flexShrink: 0, fontSize: 13, color: "var(--px-mid)" }}>Contraseña</span>
            <a href="/reset-password" style={{ fontSize: 13, color: "var(--px-ink)", textDecoration: "underline", cursor: "pointer" }}>
              Cambiar contraseña →
            </a>
          </div>
        </Section>

        {/* Staff */}
        <Section title="Personal">
          {staff.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {staff.map((s) => (
                  <StaffCard key={s.id} staff={s} />
                ))}
              </div>
              <div style={{ height: 20 }} />
            </div>
          )}

          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 14, color: "var(--px-ink2)" }}>
            Invitar conserje por email
          </div>
          {ctx.orgId ? (
            <InviteStaffForm organizationId={ctx.orgId} />
          ) : (
            <div style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 12, color: "var(--px-mid)" }}>
              Completa el onboarding para invitar personal.
            </div>
          )}
        </Section>

      </div>
    </>
  );
}

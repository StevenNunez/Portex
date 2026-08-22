import { redirect } from "next/navigation";
import { getUserContext } from "@/lib/user-context";
import { getStaff } from "@/lib/db";
import InviteStaffForm from "./InviteStaffForm";
import StaffCard from "@/components/admin/StaffCard";
import { EditarEdificio, EditarMiCuenta } from "@/components/admin/EditarEdificio";
import CodigoEdificio from "@/components/admin/CodigoEdificio";
import { obtenerOCrearCodigo } from "@/lib/autoregistro";
import { appUrl } from "@/lib/app-url";

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

export default async function ConfigPage() {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");

  const staff = ctx.buildingId ? await getStaff(ctx.buildingId) : [];
  // El código del cartel: se crea la primera vez que alguien abre esta página.
  const codigo = ctx.buildingId && ctx.role === "admin"
    ? await obtenerOCrearCodigo(ctx.buildingId)
    : null;

  return (
    <>
      <header className="px-head">
        <div style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 11, color: "var(--px-mid)", letterSpacing: "0.08em" }}>
          AJUSTES
        </div>
        <h1 style={{ margin: "4px 0 0", fontWeight: 600, letterSpacing: "-0.025em" }}>
          Configuración
        </h1>
      </header>

      <div style={{ flex: 1, overflow: "auto", padding: "28px 32px", display: "flex", flexDirection: "column", gap: 20, maxWidth: 780 }}>

        {/* Edificio */}
        <Section title="Edificio">
          <EditarEdificio
            nombre={ctx.buildingName ?? ""}
            unidades={ctx.unitsTotal}
            organizacion={ctx.orgName ?? ""}
          />
        </Section>

        {/* Acceso de los residentes */}
        {ctx.role === "admin" && (
          <Section title="Acceso de los residentes">
            <CodigoEdificio
              codigoInicial={codigo}
              buildingName={ctx.buildingName ?? "tu edificio"}
              appUrl={appUrl()}
            />
          </Section>
        )}

        {/* Mi cuenta */}
        <Section title="Mi cuenta">
          <EditarMiCuenta nombre={ctx.staffName} rol={ctx.role} />
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

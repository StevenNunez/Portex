import Link from "next/link";
import { redirect } from "next/navigation";
import { getUserContext } from "@/lib/user-context";
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

        {/* El personal se mudó: con treinta personas esta página era una
            lista interminable. Queda el atajo. */}
        <Section title="Personal">
          <p style={{ margin: "0 0 14px", fontSize: 13.5, color: "var(--px-mid)", lineHeight: 1.6 }}>
            Las fichas del equipo —contacto, correo y a quién llamar en una
            emergencia— viven en su propia pantalla.
          </p>
          <Link
            href="/admin/personal"
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "9px 14px", borderRadius: 8,
              background: "white", border: "1px solid var(--px-line)",
              fontSize: 13, fontWeight: 500, color: "var(--px-ink2)", textDecoration: "none",
            }}
          >
            Ir a Personal
            <span style={{ color: "var(--px-mid)" }}>→</span>
          </Link>
        </Section>

      </div>
    </>
  );
}

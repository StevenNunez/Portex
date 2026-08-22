import { redirect } from "next/navigation";
import { getResidents } from "@/lib/db";
import { getPerfilesResumen } from "@/lib/perfil";
import { getUserContext } from "@/lib/user-context";
import AddResidenteButton from "@/components/admin/AddResidenteButton";
import ImportResidentesButton from "@/components/admin/ImportResidentesButton";
import InvitarResidentesButton from "@/components/admin/InvitarResidentesButton";
import ResidentesClient from "./ResidentesClient";

export const revalidate = 0;

export default async function ResidentesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");
  if (!ctx.buildingId) redirect("/onboarding");

  const [rows, params, perfiles] = await Promise.all([
    getResidents(ctx.buildingId),
    searchParams,
    getPerfilesResumen(ctx.buildingId),
  ]);
  const isAdmin = ctx.role === "admin";
  const initialSearch = params.q ?? "";

  return (
    <>
      <header className="px-head">
        <div className="px-head-fila">
          <div>
            <div style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 11, color: "var(--px-mid)", letterSpacing: "0.08em" }}>
              PADRÓN DE RESIDENTES
            </div>
            <h1 style={{ margin: "4px 0 0", fontWeight: 600, letterSpacing: "-0.025em" }}>
              Residentes
            </h1>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {isAdmin && <InvitarResidentesButton rows={rows} />}
            <ImportResidentesButton />
            <AddResidenteButton />
          </div>
        </div>
      </header>

      <ResidentesClient
        rows={rows}
        isAdmin={isAdmin}
        initialSearch={initialSearch}
        // El Map no cruza la frontera servidor→cliente: viaja como objeto.
        perfiles={Object.fromEntries(perfiles)}
      />
    </>
  );
}

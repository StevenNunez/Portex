import { redirect } from "next/navigation";
import { getResidents } from "@/lib/db";
import { getUserContext } from "@/lib/user-context";
import AddResidenteButton from "@/components/admin/AddResidenteButton";
import ImportResidentesButton from "@/components/admin/ImportResidentesButton";
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

  const [rows, params] = await Promise.all([
    getResidents(ctx.buildingId),
    searchParams,
  ]);
  const isAdmin = ctx.role === "admin";
  const initialSearch = params.q ?? "";

  return (
    <>
      <header style={{
        padding: "22px 32px 18px",
        borderBottom: "1px solid var(--px-line)",
        flexShrink: 0, background: "white",
      }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 11, color: "var(--px-mid)", letterSpacing: "0.08em" }}>
              PADRÓN DE RESIDENTES
            </div>
            <h1 style={{ margin: "4px 0 0", fontSize: 30, fontWeight: 600, letterSpacing: "-0.025em" }}>
              Residentes
            </h1>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <ImportResidentesButton />
            <AddResidenteButton />
          </div>
        </div>
      </header>

      <ResidentesClient rows={rows} isAdmin={isAdmin} initialSearch={initialSearch} />
    </>
  );
}

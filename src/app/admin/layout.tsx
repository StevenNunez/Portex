import { redirect } from "next/navigation";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { getUserContext } from "@/lib/user-context";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");
  // El panel es solo del administrador; cada quien a su pantalla.
  if (ctx.role !== "admin") redirect("/inicio");

  return (
    <div style={{ display: "flex", minHeight: "100dvh", background: "var(--px-bone)" }}>
      <AdminSidebar
        buildingName={ctx.buildingName}
        unitsTotal={ctx.unitsTotal}
        staffName={ctx.staffName}
        role={ctx.role}
      />
      <main style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "auto" }}>
        {children}
      </main>
    </div>
  );
}

import { redirect } from "next/navigation";
import { getUserContext } from "@/lib/user-context";

export const revalidate = 0;

/**
 * Puerta única: todos entran por /login y esta ruta los deja en su
 * pantalla. Un solo acceso que memorizar, y el rol lo decide el
 * servidor — no el cliente, que puede mentir.
 */
export default async function InicioPage() {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");

  // Cuenta recién creada que todavía no armó su condominio
  if (!ctx.orgId) redirect("/onboarding");

  switch (ctx.role) {
    case "admin":
      redirect("/admin");
    case "conserje":
      redirect("/conserje");
    case "residente":
      redirect("/residente");
    default:
      redirect("/residente");
  }
}

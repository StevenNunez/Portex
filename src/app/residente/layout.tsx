import { redirect } from "next/navigation";
import { getUserContext } from "@/lib/user-context";

/**
 * El portal del residente. Un admin o un conserje que caiga acá se va a
 * su propia pantalla: cada rol tiene una sola casa.
 */
export default async function ResidenteLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");
  if (ctx.role !== "residente") redirect("/inicio");

  return <>{children}</>;
}

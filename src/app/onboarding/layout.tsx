import { redirect } from "next/navigation";
import { getUserContext } from "@/lib/user-context";

/**
 * El onboarding es solo para la cuenta que recién se registró y todavía
 * no tiene organización. Quien ya pertenece a una se va a su pantalla:
 * el conserje invitado no tiene nada que crear acá.
 */
export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");
  if (ctx.role !== "admin") redirect("/conserje");
  if (ctx.orgId) redirect("/admin");

  return <>{children}</>;
}

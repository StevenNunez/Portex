import { createAuthServerClient } from "./supabase-auth-server";
import { createServerClient } from "./supabase-server";

export interface UserContext {
  userId: string;
  role: string;
  staffName: string;
  orgId: string | null;
  orgName: string | null;
  buildingId: string | null;
  buildingName: string | null;
  unitsTotal: number | null;
}

/**
 * Returns the auth context for the currently logged-in user.
 * Uses service role to query profiles + buildings (bypasses RLS safely).
 * Returns null if no session.
 */
export async function getUserContext(): Promise<UserContext | null> {
  const authClient = await createAuthServerClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) return null;

  const db = createServerClient();

  const { data: profile } = await db
    .from("profiles")
    .select("organization_id, role, full_name")
    .eq("id", user.id)
    .single();

  if (!profile) return null;

  if (!profile.organization_id) {
    return {
      userId: user.id,
      role: profile.role ?? "admin",
      staffName: profile.full_name ?? user.email ?? "Usuario",
      orgId: null,
      orgName: null,
      buildingId: null,
      buildingName: null,
      unitsTotal: null,
    };
  }

  const [buildingRes, orgRes] = await Promise.all([
    db
      .from("buildings")
      .select("id, name, units_total")
      .eq("organization_id", profile.organization_id)
      .limit(1)
      .maybeSingle(),
    db
      .from("organizations")
      .select("name")
      .eq("id", profile.organization_id)
      .single(),
  ]);

  return {
    userId: user.id,
    role: profile.role ?? "admin",
    staffName: profile.full_name ?? user.email ?? "Usuario",
    orgId: profile.organization_id,
    orgName: orgRes.data?.name ?? null,
    buildingId: buildingRes.data?.id ?? null,
    buildingName: buildingRes.data?.name ?? null,
    unitsTotal: buildingRes.data?.units_total ?? null,
  };
}

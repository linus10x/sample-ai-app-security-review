import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createBearerClient, createUserClient } from "@/lib/supabase/server";

export type AuthContext = {
  userId: string;
  email: string;
  orgId: string;
  role: "member" | "admin";
  db: SupabaseClient;
};

/** Resolve the caller from a Bearer token (API clients) or the session cookie (browser). */
export async function getAuth(req?: Request): Promise<AuthContext | null> {
  const header = req?.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  const db = token ? createBearerClient(token) : await createUserClient();
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) return null;
  const { data: profile } = await db
    .from("profiles")
    .select("org_id, role")
    .eq("user_id", data.user.id)
    .maybeSingle();
  if (!profile) return null;
  return {
    userId: data.user.id,
    email: data.user.email ?? "",
    orgId: profile.org_id,
    role: profile.role,
    db,
  };
}

export async function requireAuth(): Promise<AuthContext> {
  const auth = await getAuth();
  if (!auth) redirect("/login");
  return auth;
}

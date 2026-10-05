"use server";

import { redirect } from "next/navigation";
import { createUserClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function login(formData: FormData) {
  const db = await createUserClient();
  const { error } = await db.auth.signInWithPassword({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  });
  if (error) redirect("/login?error=1");
  redirect("/products");
}

export async function signup(formData: FormData) {
  const orgName = String(formData.get("orgName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const admin = createAdminClient();

  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !created.user) redirect("/signup?error=1");

  const { data: org } = await admin.from("orgs").insert({ name: orgName }).select("id").single();
  await admin.from("profiles").insert({ user_id: created.user.id, org_id: org!.id, role: "admin" });

  const db = await createUserClient();
  await db.auth.signInWithPassword({ email, password });
  redirect("/products");
}

export async function logout() {
  const db = await createUserClient();
  await db.auth.signOut();
  redirect("/login");
}

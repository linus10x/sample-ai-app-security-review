"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export type ClearNotesResult = { ok: true } | { ok: false; error: string };

/** Admins can clear their own organisation's product notes. */
export async function clearOrgNotes(): Promise<ClearNotesResult> {
  const auth = await requireAuth();
  if (auth.role !== "admin") return { ok: false, error: "Admins only" };
  const { error } = await createAdminClient().from("product_notes").delete().eq("org_id", auth.orgId);
  if (error) return { ok: false, error: "Could not clear notes" };
  revalidatePath("/admin");
  return { ok: true };
}

"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";

export async function addNote(formData: FormData) {
  const auth = await requireAuth();
  const productId = String(formData.get("productId"));
  const body = String(formData.get("body") ?? "");
  await auth.db
    .from("product_notes")
    .insert({ org_id: auth.orgId, product_id: productId, author_id: auth.userId, body });
  revalidatePath(`/products/${productId}`);
}

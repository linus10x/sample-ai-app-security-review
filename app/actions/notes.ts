"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { noteInput } from "@/lib/notes";

export async function addNote(formData: FormData) {
  const auth = await requireAuth();
  const parsed = noteInput.safeParse({ productId: formData.get("productId"), body: formData.get("body") });
  if (!parsed.success) return;
  await auth.db.from("product_notes").insert({
    org_id: auth.orgId,
    product_id: parsed.data.productId,
    author_id: auth.userId,
    body: parsed.data.body,
  });
  revalidatePath(`/products/${parsed.data.productId}`);
}

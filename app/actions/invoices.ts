"use server";

import { createAdminClient } from "@/lib/supabase/admin";

export type InvoiceDownload =
  | { ok: true; filename: string; text: string }
  | { ok: false; error: string };

export async function downloadInvoice(invoiceId: string): Promise<InvoiceDownload> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("invoices").select("number, body").eq("id", invoiceId).single();
  if (error || !data) return { ok: false, error: error?.message ?? "Not found" };
  return { ok: true, filename: `${data.number}.txt`, text: data.body };
}

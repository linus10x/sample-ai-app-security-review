"use server";

import { requireAuth } from "@/lib/auth";
import { getInvoiceForOrg } from "@/lib/invoices";

export type InvoiceDownload =
  | { ok: true; filename: string; text: string }
  | { ok: false; error: string };

export async function downloadInvoice(invoiceId: string): Promise<InvoiceDownload> {
  const auth = await requireAuth();
  const found = await getInvoiceForOrg(auth.db, auth.orgId, invoiceId);
  if (!found.ok) return { ok: false, error: "Invoice not found" };
  return { ok: true, filename: `${found.invoice.number}.txt`, text: found.invoice.body };
}

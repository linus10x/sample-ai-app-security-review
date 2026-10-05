export type InvoiceLine = { name: string; quantity: number; unit_cents: number };

export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function invoiceNumber(orderId: string): string {
  return `INV-${orderId.slice(0, 8).toUpperCase()}`;
}

export function buildInvoiceText(orgName: string, orderId: string, lines: InvoiceLine[]): string {
  const total = lines.reduce((sum, l) => sum + l.quantity * l.unit_cents, 0);
  const rows = lines.map((l) => `${l.quantity} x ${l.name} @ ${formatCents(l.unit_cents)}`);
  return [
    `Invoice ${invoiceNumber(orderId)}`,
    `Billed to: ${orgName}`,
    ...rows,
    `Total: ${formatCents(total)}`,
  ].join("\n");
}

export type InvoiceRecord = { org_id: string; number: string; body: string };
export type InvoiceLookup = { ok: true; invoice: InvoiceRecord } | { ok: false };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Fetch an invoice for the caller's organisation. The query runs as the user, so row level
 * security already filters it, and the org check below is a second, explicit gate.
 * A missing invoice and another organisation's invoice look identical to the caller.
 */
export async function getInvoiceForOrg(
  db: import("@supabase/supabase-js").SupabaseClient,
  orgId: string,
  invoiceId: string,
): Promise<InvoiceLookup> {
  if (!UUID.test(invoiceId)) return { ok: false };
  const { data, error } = await db.from("invoices").select("org_id, number, body").eq("id", invoiceId).maybeSingle();
  if (error || !data || data.org_id !== orgId) return { ok: false };
  return { ok: true, invoice: data as InvoiceRecord };
}

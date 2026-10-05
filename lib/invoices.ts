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

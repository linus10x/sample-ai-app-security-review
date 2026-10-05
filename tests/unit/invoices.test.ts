import { describe, expect, it } from "vitest";
import { buildInvoiceText, formatCents, getInvoiceForOrg, invoiceNumber } from "@/lib/invoices";
import { fakeDb } from "./fake-db";

const ID = "11111111-1111-4111-8111-111111111111";
const row = { org_id: "org-a", number: "INV-1", body: "Invoice INV-1" };

describe("getInvoiceForOrg", () => {
  it("returns the invoice to its own organisation", async () => {
    const { db } = fakeDb({ selects: { invoices: { data: row, error: null } } });
    expect(await getInvoiceForOrg(db, "org-a", ID)).toEqual({ ok: true, invoice: row });
  });

  it("refuses another organisation even if the query returned the row", async () => {
    const { db } = fakeDb({ selects: { invoices: { data: row, error: null } } });
    expect(await getInvoiceForOrg(db, "org-b", ID)).toEqual({ ok: false });
  });

  it("treats a missing invoice and a database error the same way", async () => {
    expect(await getInvoiceForOrg(fakeDb({ selects: { invoices: { data: null, error: null } } }).db, "org-a", ID)).toEqual({ ok: false });
    expect(await getInvoiceForOrg(fakeDb({ selects: { invoices: { data: null, error: { message: "x" } } } }).db, "org-a", ID)).toEqual({ ok: false });
  });

  it("does not query for an id that is not a uuid", async () => {
    const { db, calls } = fakeDb({});
    expect(await getInvoiceForOrg(db, "org-a", "../../etc/passwd")).toEqual({ ok: false });
    expect(calls).toEqual([]);
  });
});

describe("invoice text", () => {
  it("formats cents and totals the lines", () => {
    expect(formatCents(1999)).toBe("$19.99");
    const text = buildInvoiceText("Test Org", "abcdef12-0000-4000-8000-000000000000", [
      { name: "Napkins", quantity: 2, unit_cents: 450 },
    ]);
    expect(text).toContain(invoiceNumber("abcdef12-0000-4000-8000-000000000000"));
    expect(text).toContain("2 x Napkins @ $4.50");
    expect(text).toContain("Total: $9.00");
  });
});

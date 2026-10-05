import { describe, expect, it } from "vitest";
import type Stripe from "stripe";
import { handleStripeEvent } from "@/lib/webhook";
import { fakeDb } from "./fake-db";

const order = {
  data: { orgs: { name: "Test Org" }, order_items: [{ quantity: 2, unit_cents: 500, products: { name: "Napkins" } }] },
  error: null,
};

function event(overrides: Partial<{ type: string; payment_status: string; metadata: Record<string, string> }> = {}) {
  return {
    id: "evt_1",
    type: overrides.type ?? "checkout.session.completed",
    data: { object: { payment_status: overrides.payment_status ?? "paid", metadata: overrides.metadata ?? { order_id: "11111111-2222-3333-4444-555555555555" } } },
  } as unknown as Stripe.Event;
}

describe("handleStripeEvent", () => {
  it("ignores event types it does not handle", async () => {
    const { db, calls } = fakeDb({});
    expect(await handleStripeEvent(db, event({ type: "customer.created" }))).toEqual({ status: "ignored" });
    expect(calls).toEqual([]);
  });

  it("ignores a session that is not paid", async () => {
    const { db } = fakeDb({});
    expect(await handleStripeEvent(db, event({ payment_status: "unpaid" }))).toEqual({ status: "ignored" });
  });

  it("refuses a session with no order id", async () => {
    const { db } = fakeDb({});
    await expect(handleStripeEvent(db, event({ metadata: {} }))).rejects.toThrow("no order_id");
  });

  it("fulfils once and sends the event id and an invoice to the database function", async () => {
    const { db, calls } = fakeDb({ selects: { orders: order }, rpc: { data: true, error: null } });
    expect(await handleStripeEvent(db, event())).toEqual({ status: "fulfilled" });
    const rpc = calls.find((c) => c.rpc === "fulfil_checkout")!;
    expect(rpc.args).toMatchObject({ p_event_id: "evt_1", p_invoice_number: "INV-11111111" });
    expect((rpc.args as { p_invoice_body: string }).p_invoice_body).toContain("Billed to: Test Org");
    expect((rpc.args as { p_invoice_body: string }).p_invoice_body).toContain("Total: $10.00");
  });

  it("reports a replay as a duplicate", async () => {
    const { db } = fakeDb({ selects: { orders: order }, rpc: { data: false, error: null } });
    expect(await handleStripeEvent(db, event())).toEqual({ status: "duplicate" });
  });

  it("surfaces database errors so Stripe retries", async () => {
    const lookup = fakeDb({ selects: { orders: { data: null, error: { message: "boom" } } } });
    await expect(handleStripeEvent(lookup.db, event())).rejects.toEqual({ message: "boom" });
    const rpc = fakeDb({ selects: { orders: order }, rpc: { data: null, error: { message: "rpc failed" } } });
    await expect(handleStripeEvent(rpc.db, event())).rejects.toEqual({ message: "rpc failed" });
  });
});

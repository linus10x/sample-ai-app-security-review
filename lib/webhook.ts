import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildInvoiceText, invoiceNumber } from "@/lib/invoices";

export type WebhookResult = { status: "ignored" | "fulfilled" | "duplicate" | "amount_mismatch" };

type OrderRow = {
  total_cents: number;
  orgs: { name: string };
  order_items: { quantity: number; unit_cents: number; products: { name: string } }[];
};

/** Fulfil a paid checkout exactly once per Stripe event id. */
export async function handleStripeEvent(db: SupabaseClient, event: Stripe.Event): Promise<WebhookResult> {
  if (event.type !== "checkout.session.completed") return { status: "ignored" };
  const session = event.data.object as Stripe.Checkout.Session;
  if (session.payment_status !== "paid") return { status: "ignored" };
  const orderId = session.metadata?.order_id;
  if (!orderId) throw new Error("checkout session carries no order_id");

  const { data, error } = await db
    .from("orders")
    .select("total_cents, orgs(name), order_items(quantity, unit_cents, products(name))")
    .eq("id", orderId)
    .single();
  if (error) throw error;
  const order = data as unknown as OrderRow;

  // What Stripe says was paid must equal what we stored for the order. If they differ, do not
  // fulfil. Answering 200 stops Stripe retrying, and the log line is for a person to look at.
  if (session.amount_total !== order.total_cents) {
    console.error(
      JSON.stringify({ level: "error", event: "amount_mismatch", orderId, eventId: event.id, paid: session.amount_total, expected: order.total_cents }),
    );
    return { status: "amount_mismatch" };
  }

  const body = buildInvoiceText(
    order.orgs.name,
    orderId,
    order.order_items.map((i) => ({ name: i.products.name, quantity: i.quantity, unit_cents: i.unit_cents })),
  );
  const { data: fulfilled, error: rpcError } = await db.rpc("fulfil_checkout", {
    p_event_id: event.id,
    p_order_id: orderId,
    p_invoice_number: invoiceNumber(orderId),
    p_invoice_body: body,
  });
  if (rpcError) throw rpcError;
  return { status: fulfilled ? "fulfilled" : "duplicate" };
}

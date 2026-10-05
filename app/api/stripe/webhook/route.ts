import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildInvoiceText, invoiceNumber } from "@/lib/invoices";
import { fail } from "@/lib/http";
import { getStripe } from "@/lib/stripe";
import { env } from "@/lib/env";
import type Stripe from "stripe";

export async function POST(req: Request) {
  try {
    // Signature check needs the exact bytes Stripe sent, so read the raw body.
    const raw = await req.text();
    const signature = req.headers.get("stripe-signature");
    if (!signature) return NextResponse.json({ error: "Missing signature" }, { status: 400 });
    let event: Stripe.Event;
    try {
      event = getStripe().webhooks.constructEvent(raw, signature, env.webhookSecret());
    } catch {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const orderId = session.metadata?.order_id as string;
      const admin = createAdminClient();

      await admin.from("orders").update({ status: "paid" }).eq("id", orderId);
      await admin.from("shipments").insert({ order_id: orderId });

      const { data: order } = await admin.from("orders").select("org_id").eq("id", orderId).single();
      const { data: org } = await admin.from("orgs").select("name").eq("id", order!.org_id).single();
      const { data: items } = await admin
        .from("order_items")
        .select("quantity, unit_cents, products(name)")
        .eq("order_id", orderId);
      const lines = (items ?? []).map((i) => ({
        name: (i.products as unknown as { name: string }).name,
        quantity: i.quantity,
        unit_cents: i.unit_cents,
      }));
      await admin.from("invoices").insert({
        order_id: orderId,
        org_id: order!.org_id,
        number: invoiceNumber(orderId),
        body: buildInvoiceText(org!.name, orderId, lines),
      });
    }
    return NextResponse.json({ received: true });
  } catch (e) {
    return fail(e);
  }
}

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildInvoiceText, invoiceNumber } from "@/lib/invoices";
import { fail } from "@/lib/http";

export async function POST(req: Request) {
  try {
    const event = JSON.parse(await req.text());

    if (event.type === "checkout.session.completed") {
      const orderId = event.data.object.metadata?.order_id as string;
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

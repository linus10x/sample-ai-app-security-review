import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { dbError, fail } from "@/lib/http";
import { getStripe } from "@/lib/stripe";
import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkoutBody, uniqueProductIds } from "@/lib/checkout";
import { priceItems, UnknownProductError, type CatalogueProduct } from "@/lib/pricing";

export async function POST(req: Request) {
  try {
    const auth = await getAuth(req);
    if (!auth) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

    const parsed = checkoutBody.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    const { items } = parsed.data;

    const ids = uniqueProductIds(items);
    const { data: products, error } = await auth.db
      .from("products")
      .select("id, name, price_cents, stripe_price_id")
      .in("id", ids);
    if (error) throw dbError(error, "select id, name, price_cents, stripe_price_id from products where id in (...)");

    let priced;
    try {
      priced = priceItems(items, (products ?? []) as CatalogueProduct[]);
    } catch (e) {
      if (e instanceof UnknownProductError) return NextResponse.json({ error: "Unknown product" }, { status: 400 });
      throw e;
    }

    const { data: order, error: orderErr } = await auth.db
      .from("orders")
      .insert({ org_id: auth.orgId, user_id: auth.userId, status: "pending", total_cents: priced.total })
      .select("id")
      .single();
    if (orderErr) throw dbError(orderErr, "insert into orders (org_id, user_id, status, total_cents) values (...)");

    const { error: itemsErr } = await auth.db.from("order_items").insert(
      priced.lines.map((l) => ({
        order_id: order.id,
        product_id: l.productId,
        quantity: l.quantity,
        unit_cents: l.unit_cents,
      })),
    );
    if (itemsErr) throw dbError(itemsErr, "insert into order_items (...) values (...)");

    // Stripe charges the Price we stored for each product, never an amount from the browser.
    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      success_url: `${env.appUrl()}/orders?paid=1`,
      cancel_url: `${env.appUrl()}/cart`,
      metadata: { order_id: order.id },
      line_items: priced.lines.map((l) => ({ price: l.stripe_price_id, quantity: l.quantity })),
    });

    await createAdminClient().from("orders").update({ stripe_session_id: session.id }).eq("id", order.id);
    return NextResponse.json({ orderId: order.id, url: session.url });
  } catch (e) {
    return fail(e);
  }
}

import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { dbError, fail } from "@/lib/http";
import { getStripe } from "@/lib/stripe";
import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

type CartItem = { productId: string; quantity: number; unitAmount: number };

export async function POST(req: Request) {
  try {
    const auth = await getAuth(req);
    if (!auth) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

    const body = await req.json();
    const items: CartItem[] = body.items;

    const ids = items.map((i) => i.productId);
    const { data: products, error } = await auth.db.from("products").select("id, name").in("id", ids);
    if (error) throw dbError(error, `select id, name from products where id in (${ids.join(",")})`);

    // The cart already carries the price the shopper saw, so use it.
    const total = items.reduce((sum, i) => sum + i.unitAmount * i.quantity, 0);

    const { data: order, error: orderErr } = await auth.db
      .from("orders")
      .insert({ org_id: auth.orgId, user_id: auth.userId, status: "pending", total_cents: total })
      .select("id")
      .single();
    if (orderErr) throw dbError(orderErr, "insert into orders (org_id, user_id, status, total_cents) values (...)");

    const { error: itemsErr } = await auth.db.from("order_items").insert(
      items.map((i) => ({
        order_id: order.id,
        product_id: i.productId,
        quantity: i.quantity,
        unit_cents: i.unitAmount,
      })),
    );
    if (itemsErr) throw dbError(itemsErr, "insert into order_items (...) values (...)");

    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      success_url: `${env.appUrl()}/orders?paid=1`,
      cancel_url: `${env.appUrl()}/cart`,
      metadata: { order_id: order.id },
      line_items: items.map((i) => ({
        quantity: i.quantity,
        price_data: {
          currency: "usd",
          unit_amount: i.unitAmount,
          product_data: { name: products?.find((p) => p.id === i.productId)?.name ?? "Item" },
        },
      })),
    });

    await createAdminClient().from("orders").update({ stripe_session_id: session.id }).eq("id", order.id);
    return NextResponse.json({ orderId: order.id, url: session.url });
  } catch (e) {
    return fail(e);
  }
}

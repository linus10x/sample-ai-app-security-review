import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { dbError, HttpError, readJson, withApi } from "@/lib/http";
import { getStripe } from "@/lib/stripe";
import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkoutBody, uniqueProductIds } from "@/lib/checkout";
import { priceItems, UnknownProductError, type CatalogueProduct } from "@/lib/pricing";

export const POST = withApi(async (req) => {
  const auth = await getAuth(req);
  if (!auth) throw new HttpError(401, "Not signed in");

  const parsed = checkoutBody.safeParse(await readJson(req));
  if (!parsed.success) throw new HttpError(400, "Invalid request");
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
    if (e instanceof UnknownProductError) throw new HttpError(400, "Unknown product");
    throw e;
  }

  // Orders and their lines are written by the server only. Members have no insert access.
  const admin = createAdminClient();
  const { data: order, error: orderErr } = await admin
    .from("orders")
    .insert({ org_id: auth.orgId, user_id: auth.userId, status: "pending", total_cents: priced.total })
    .select("id")
    .single();
  if (orderErr) throw dbError(orderErr, "insert into orders (org_id, user_id, status, total_cents) values (...)");

  const { error: itemsErr } = await admin.from("order_items").insert(
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

  const { error: sessionErr } = await admin
    .from("orders")
    .update({ stripe_session_id: session.id })
    .eq("id", order.id);
  if (sessionErr) throw dbError(sessionErr, "update orders set stripe_session_id = ... where id = ...");

  return NextResponse.json({ orderId: order.id, totalCents: priced.total, url: session.url });
});

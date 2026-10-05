import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { HttpError, withApi } from "@/lib/http";
import { getStripe } from "@/lib/stripe";
import { env } from "@/lib/env";
import { handleStripeEvent } from "@/lib/webhook";

export const POST = withApi(async (req) => {
  // Signature check needs the exact bytes Stripe sent, so read the raw body.
  const raw = await req.text();
  const signature = req.headers.get("stripe-signature");
  if (!signature) throw new HttpError(400, "Missing signature");
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(raw, signature, env.webhookSecret());
  } catch {
    throw new HttpError(400, "Invalid signature");
  }

  const result = await handleStripeEvent(createAdminClient(), event);
  return NextResponse.json({ received: true, ...result });
});

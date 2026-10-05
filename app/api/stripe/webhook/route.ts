import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { fail } from "@/lib/http";
import { getStripe } from "@/lib/stripe";
import { env } from "@/lib/env";
import { handleStripeEvent } from "@/lib/webhook";

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

    const result = await handleStripeEvent(createAdminClient(), event);
    return NextResponse.json({ received: true, ...result });
  } catch (e) {
    return fail(e);
  }
}

import Stripe from "stripe";
import { env } from "@/lib/env";

export function getStripe(): Stripe {
  const host = process.env.STRIPE_API_HOST;
  return new Stripe(env.stripeKey(), host
    ? {
        host,
        port: process.env.STRIPE_API_PORT ?? "12111",
        protocol: (process.env.STRIPE_API_PROTOCOL as "http" | "https") ?? "http",
      }
    : {});
}

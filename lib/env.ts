export const env = {
  supabaseUrl: () => process.env.NEXT_PUBLIC_SUPABASE_URL!,
  anonKey: () => process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  serviceKey: () => process.env.SUPABASE_SERVICE_ROLE_KEY!,
  stripeKey: () => process.env.STRIPE_SECRET_KEY!,
  webhookSecret: () => process.env.STRIPE_WEBHOOK_SECRET!,
  appUrl: () => process.env.APP_URL ?? "http://localhost:3000",
};

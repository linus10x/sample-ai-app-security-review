import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("cart", () => {
  it("adds, merges repeated products and persists", async () => {
    const { addToCart, readCart } = await import("@/lib/cart");
    addToCart({ productId: "p1", name: "Napkins", unitAmount: 450 });
    addToCart({ productId: "p1", name: "Napkins", unitAmount: 450 }, 2);
    addToCart({ productId: "p2", name: "Cups", unitAmount: 825 });
    expect(readCart()).toEqual([
      { productId: "p1", name: "Napkins", unitAmount: 450, quantity: 3 },
      { productId: "p2", name: "Cups", unitAmount: 825, quantity: 1 },
    ]);
  });
  it("treats damaged storage as an empty cart", async () => {
    store.set("cedar-cart", "{broken");
    const { readCart, writeCart } = await import("@/lib/cart");
    expect(readCart()).toEqual([]);
    writeCart([]);
    expect(store.get("cedar-cart")).toBe("[]");
  });
});

describe("env, stripe and supabase client factories", () => {
  it("reads settings from the environment", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://db.test");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service");
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_123");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_x");
    vi.stubEnv("APP_URL", "");
    const { env } = await import("@/lib/env");
    expect([env.supabaseUrl(), env.anonKey(), env.serviceKey(), env.stripeKey(), env.webhookSecret()]).toEqual(["http://db.test", "anon", "service", "sk_test_123", "whsec_x"]);
    delete process.env.APP_URL;
    expect(env.appUrl()).toBe("http://localhost:3000");
    vi.unstubAllEnvs();
  });

  it("points the Stripe client at stripe-mock when a host is set, and at Stripe otherwise", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_123");
    const { getStripe } = await import("@/lib/stripe");
    expect(getStripe()).toBeTruthy();
    vi.stubEnv("STRIPE_API_HOST", "127.0.0.1");
    expect(getStripe()).toBeTruthy();
    vi.unstubAllEnvs();
  });

  it("builds a service role client and a bearer client", async () => {
    vi.doMock("server-only", () => ({}));
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://db.test");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service");
    const { createAdminClient } = await import("@/lib/supabase/admin");
    expect(createAdminClient().auth).toBeTruthy();
    vi.doMock("next/headers", () => ({ cookies: async () => ({ getAll: () => [], set: vi.fn() }) }));
    const { createBearerClient, createUserClient } = await import("@/lib/supabase/server");
    expect(createBearerClient("tok").auth).toBeTruthy();
    expect((await createUserClient()).auth).toBeTruthy();
    vi.unstubAllEnvs();
  });
});

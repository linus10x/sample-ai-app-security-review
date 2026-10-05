import { describe, expect, it } from "vitest";
import { priceItems, UnknownProductError } from "@/lib/pricing";
import { checkoutBody, uniqueProductIds } from "@/lib/checkout";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const catalogue = [
  { id: A, name: "Napkins", price_cents: 450, stripe_price_id: "price_a" },
  { id: B, name: "Cups", price_cents: 825, stripe_price_id: "price_b" },
];

describe("priceItems", () => {
  it("prices every line from the catalogue and totals them", () => {
    const { lines, total } = priceItems([{ productId: A, quantity: 2 }, { productId: B, quantity: 1 }], catalogue);
    expect(lines.map((l) => l.unit_cents)).toEqual([450, 825]);
    expect(total).toBe(2 * 450 + 825);
    expect(lines[0].stripe_price_id).toBe("price_a");
  });

  it("rejects a product that is not in the catalogue", () => {
    expect(() => priceItems([{ productId: "33333333-3333-4333-8333-333333333333", quantity: 1 }], catalogue)).toThrow(UnknownProductError);
  });
});

describe("checkoutBody", () => {
  it("drops any price a client tries to send", () => {
    const parsed = checkoutBody.parse({ items: [{ productId: A, quantity: 1, unitAmount: 1 }] });
    expect(parsed.items[0]).toEqual({ productId: A, quantity: 1 });
  });

  it.each([
    ["not a uuid", { items: [{ productId: "x", quantity: 1 }] }],
    ["zero quantity", { items: [{ productId: A, quantity: 0 }] }],
    ["fractional quantity", { items: [{ productId: A, quantity: 1.5 }] }],
    ["huge quantity", { items: [{ productId: A, quantity: 501 }] }],
    ["empty cart", { items: [] }],
    ["missing items", {}],
  ])("rejects %s", (_name, body) => {
    expect(checkoutBody.safeParse(body).success).toBe(false);
  });

  it("de-duplicates product ids for the catalogue lookup", () => {
    expect(uniqueProductIds([{ productId: A, quantity: 1 }, { productId: A, quantity: 2 }])).toEqual([A]);
  });
});

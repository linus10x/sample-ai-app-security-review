import { z } from "zod";

export const checkoutBody = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.number().int().min(1).max(500),
      }),
    )
    .min(1)
    .max(50),
});

export type CheckoutBody = z.infer<typeof checkoutBody>;

/** Merge repeated products so a catalogue lookup returns one row per product. */
export function uniqueProductIds(items: CheckoutBody["items"]): string[] {
  return [...new Set(items.map((i) => i.productId))];
}

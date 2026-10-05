import { z } from "zod";

export const importBody = z.object({ url: z.string().min(1).max(2000) });

const feedSchema = z
  .array(
    z.object({
      sku: z.string().min(1).max(40),
      name: z.string().min(1).max(120),
      price_cents: z.number().int().min(0).max(10_000_000),
    }),
  )
  .max(500);

export type FeedItem = z.infer<typeof feedSchema>[number];

/** Parse a supplier feed. Returns null if it is not valid JSON in the expected shape. */
export function parseFeed(text: string): FeedItem[] | null {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return null;
  }
  const parsed = feedSchema.safeParse(json);
  return parsed.success ? parsed.data : null;
}

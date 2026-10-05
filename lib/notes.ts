import { z } from "zod";

export const noteInput = z.object({
  productId: z.string().uuid(),
  body: z.string().trim().min(1).max(1000),
});

export type NoteInput = z.infer<typeof noteInput>;

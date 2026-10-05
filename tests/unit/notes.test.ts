import { describe, expect, it, vi } from "vitest";
import { noteInput } from "@/lib/notes";

const ID = "11111111-1111-4111-8111-111111111111";

describe("noteInput", () => {
  it("keeps markup as plain text, trimmed", () => {
    expect(noteInput.parse({ productId: ID, body: "  <b>hi</b> " }).body).toBe("<b>hi</b>");
  });
  it.each([
    ["empty note", { productId: ID, body: "   " }],
    ["very long note", { productId: ID, body: "x".repeat(1001) }],
    ["bad product id", { productId: "nope", body: "ok" }],
  ])("rejects %s", (_n, input) => expect(noteInput.safeParse(input).success).toBe(false));
});

describe("addNote action", () => {
  it("saves a valid note for the caller's organisation and ignores an invalid one", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    vi.resetModules();
    vi.doMock("@/lib/auth", () => ({
      requireAuth: async () => ({ orgId: "org-a", userId: "user-a", db: { from: () => ({ insert }) } }),
    }));
    vi.doMock("next/cache", () => ({ revalidatePath: vi.fn() }));
    const { addNote } = await import("@/app/actions/notes");

    const good = new FormData();
    good.set("productId", ID);
    good.set("body", "<i>x</i>");
    await addNote(good);
    expect(insert).toHaveBeenCalledWith({ org_id: "org-a", product_id: ID, author_id: "user-a", body: "<i>x</i>" });

    const bad = new FormData();
    bad.set("productId", "nope");
    bad.set("body", "x");
    await addNote(bad);
    expect(insert).toHaveBeenCalledTimes(1);
  });
});

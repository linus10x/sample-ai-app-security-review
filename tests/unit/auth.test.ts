import { beforeEach, describe, expect, it, vi } from "vitest";

const redirect = vi.fn((to: string) => { throw new Error(`REDIRECT:${to}`); });
vi.mock("next/navigation", () => ({ redirect: (to: string) => redirect(to) }));

type Profile = { org_id: string; role: "member" | "admin" } | null;
function client(user: { id: string; email?: string } | null, profile: Profile, authError: unknown = null) {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: authError }) },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: profile }) }) }) }),
  };
}

const bearer = vi.fn();
const cookieClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createBearerClient: (t: string) => bearer(t),
  createUserClient: () => cookieClient(),
}));

beforeEach(() => { vi.clearAllMocks(); });

describe("getAuth", () => {
  it("uses a Bearer token when one is sent and returns the caller's organisation and role", async () => {
    bearer.mockReturnValue(client({ id: "u1", email: "a@example.com" }, { org_id: "org-a", role: "admin" }));
    const { getAuth } = await import("@/lib/auth");
    const auth = await getAuth(new Request("http://x", { headers: { authorization: "Bearer tok" } }));
    expect(bearer).toHaveBeenCalledWith("tok");
    expect(auth).toMatchObject({ userId: "u1", email: "a@example.com", orgId: "org-a", role: "admin" });
  });

  it("falls back to the session cookie when there is no Bearer header", async () => {
    cookieClient.mockResolvedValue(client({ id: "u2" }, { org_id: "org-b", role: "member" }));
    const { getAuth } = await import("@/lib/auth");
    const auth = await getAuth();
    expect(cookieClient).toHaveBeenCalled();
    expect(auth).toMatchObject({ userId: "u2", email: "", orgId: "org-b" });
  });

  it("returns null for an invalid session, or a user with no profile", async () => {
    const { getAuth } = await import("@/lib/auth");
    cookieClient.mockResolvedValueOnce(client(null, null, { message: "bad" }));
    expect(await getAuth()).toBeNull();
    cookieClient.mockResolvedValueOnce(client({ id: "u3" }, null));
    expect(await getAuth()).toBeNull();
  });
});

describe("requireAuth", () => {
  it("sends a signed-out visitor to the login page", async () => {
    cookieClient.mockResolvedValue(client(null, null));
    const { requireAuth } = await import("@/lib/auth");
    await expect(requireAuth()).rejects.toThrow("REDIRECT:/login");
  });
  it("returns the caller when signed in", async () => {
    cookieClient.mockResolvedValue(client({ id: "u1" }, { org_id: "o", role: "member" }));
    const { requireAuth } = await import("@/lib/auth");
    expect((await requireAuth()).orgId).toBe("o");
  });
});

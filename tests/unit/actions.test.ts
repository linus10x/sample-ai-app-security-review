import { beforeEach, describe, expect, it, vi } from "vitest";

const redirect = vi.fn((to: string) => { throw new Error(`REDIRECT:${to}`); });
vi.mock("next/navigation", () => ({ redirect: (to: string) => redirect(to) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const requireAuth = vi.fn();
vi.mock("@/lib/auth", () => ({ requireAuth: () => requireAuth() }));

const userClient = { auth: { signInWithPassword: vi.fn(), signOut: vi.fn() } };
const adminClient = { auth: { admin: { createUser: vi.fn() } }, from: vi.fn() };
vi.mock("@/lib/supabase/server", () => ({ createUserClient: async () => userClient }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => adminClient }));

const form = (values: Record<string, string>) => {
  const f = new FormData();
  Object.entries(values).forEach(([k, v]) => f.set(k, v));
  return f;
};

beforeEach(() => { vi.clearAllMocks(); });

describe("auth actions", () => {
  it("login sends a good sign-in to the product list", async () => {
    userClient.auth.signInWithPassword.mockResolvedValue({ error: null });
    const { login } = await import("@/app/actions/auth");
    await expect(login(form({ email: "a@example.com", password: "pw" }))).rejects.toThrow("REDIRECT:/products");
    expect(userClient.auth.signInWithPassword).toHaveBeenCalledWith({ email: "a@example.com", password: "pw" });
  });

  it("login sends a failed sign-in back with an error flag and no detail", async () => {
    userClient.auth.signInWithPassword.mockResolvedValue({ error: { message: "Invalid login credentials" } });
    const { login } = await import("@/app/actions/auth");
    await expect(login(form({ email: "a@example.com", password: "x" }))).rejects.toThrow("REDIRECT:/login?error=1");
  });

  it("signup creates the user, organisation and an admin profile, then signs in", async () => {
    adminClient.auth.admin.createUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    const insertProfile = vi.fn().mockResolvedValue({});
    adminClient.from.mockImplementation((t: string) =>
      t === "orgs"
        ? { insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: { id: "org-1" } }) }) }) }
        : { insert: insertProfile },
    );
    userClient.auth.signInWithPassword.mockResolvedValue({ error: null });
    const { signup } = await import("@/app/actions/auth");
    await expect(signup(form({ orgName: "Test Org", email: "n@example.com", password: "password-1" }))).rejects.toThrow("REDIRECT:/products");
    expect(insertProfile).toHaveBeenCalledWith({ user_id: "u1", org_id: "org-1", role: "admin" });
  });

  it("signup stops when the user cannot be created", async () => {
    adminClient.auth.admin.createUser.mockResolvedValue({ data: { user: null }, error: { message: "exists" } });
    const { signup } = await import("@/app/actions/auth");
    await expect(signup(form({ orgName: "X", email: "n@example.com", password: "password-1" }))).rejects.toThrow("REDIRECT:/signup?error=1");
    expect(adminClient.from).not.toHaveBeenCalled();
  });

  it("logout signs out and returns to the login page", async () => {
    const { logout } = await import("@/app/actions/auth");
    await expect(logout()).rejects.toThrow("REDIRECT:/login");
    expect(userClient.auth.signOut).toHaveBeenCalled();
  });
});

describe("clearOrgNotes", () => {
  it("is for admins only", async () => {
    requireAuth.mockResolvedValue({ role: "member", orgId: "o" });
    const { clearOrgNotes } = await import("@/app/actions/admin");
    expect(await clearOrgNotes()).toEqual({ ok: false, error: "Admins only" });
    expect(adminClient.from).not.toHaveBeenCalled();
  });
  it("deletes only the caller's organisation's notes", async () => {
    requireAuth.mockResolvedValue({ role: "admin", orgId: "org-a" });
    const eq = vi.fn().mockResolvedValue({ error: null });
    adminClient.from.mockReturnValue({ delete: () => ({ eq }) });
    const { clearOrgNotes } = await import("@/app/actions/admin");
    expect(await clearOrgNotes()).toEqual({ ok: true });
    expect(adminClient.from).toHaveBeenCalledWith("product_notes");
    expect(eq).toHaveBeenCalledWith("org_id", "org-a");
  });
  it("reports a database failure without the detail", async () => {
    requireAuth.mockResolvedValue({ role: "admin", orgId: "org-a" });
    adminClient.from.mockReturnValue({ delete: () => ({ eq: () => Promise.resolve({ error: { message: "secret detail" } }) }) });
    const { clearOrgNotes } = await import("@/app/actions/admin");
    expect(await clearOrgNotes()).toEqual({ ok: false, error: "Could not clear notes" });
  });
});

describe("downloadInvoice", () => {
  const ID = "11111111-1111-4111-8111-111111111111";
  const db = (data: unknown) => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data, error: null }) }) }) }) });
  it("returns the file for the caller's own invoice", async () => {
    requireAuth.mockResolvedValue({ orgId: "org-a", db: db({ org_id: "org-a", number: "INV-1", body: "text" }) });
    const { downloadInvoice } = await import("@/app/actions/invoices");
    expect(await downloadInvoice(ID)).toEqual({ ok: true, filename: "INV-1.txt", text: "text" });
  });
  it("answers 'not found' for another organisation's invoice", async () => {
    requireAuth.mockResolvedValue({ orgId: "org-a", db: db({ org_id: "org-b", number: "INV-2", body: "secret" }) });
    const { downloadInvoice } = await import("@/app/actions/invoices");
    expect(await downloadInvoice(ID)).toEqual({ ok: false, error: "Invoice not found" });
  });
});

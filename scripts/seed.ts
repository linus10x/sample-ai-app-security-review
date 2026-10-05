// Synthetic seed data: 3 organisations, 12 users, 40 products, a few paid orders.
// Safe to run more than once. Everything here is made up.
import { existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { buildInvoiceText, invoiceNumber } from "../lib/invoices";

if (existsSync(".env")) process.loadEnvFile(".env");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
const db = createClient(url, serviceKey, { auth: { persistSession: false } });

export const DEMO_PASSWORD = "demo-password-1";
const ORGS = [
  { slug: "harbor", name: "Harbor Diner Group" },
  { slug: "birchwood", name: "Birchwood Catering" },
  { slug: "northside", name: "Northside Market" },
];
const USER_ROLES: [string, "admin" | "member"][] = [
  ["admin", "admin"],
  ["buyer1", "member"],
  ["buyer2", "member"],
  ["buyer3", "member"],
];

const GROUPS: [string, string[]][] = [
  ["Paper goods", ["Napkins 500ct", "Paper cups 12oz", "Takeout boxes", "Paper towels", "Parchment sheets", "Lunch bags", "Cup sleeves", "Wax paper"]],
  ["Cleaning", ["Degreaser 1gal", "Sanitiser tabs", "Floor cleaner", "Dish soap 5gal", "Glass spray", "Bleach 1gal", "Sponges 24ct", "Mop heads"]],
  ["Kitchen", ["Nitrile gloves L", "Hairnets 100ct", "Aprons 12ct", "Foil pans", "Plastic wrap", "Squeeze bottles", "Tongs 12in", "Sheet pans"]],
  ["Pantry", ["Olive oil 1gal", "Kosher salt 3lb", "Black pepper 1lb", "Flour 25lb", "Sugar 25lb", "Rice 20lb", "Dried beans 10lb", "Vinegar 1gal"]],
  ["Front of house", ["Receipt rolls 50ct", "Table tents", "Menu covers", "Candles 24ct", "Coasters 500ct", "Straws 1000ct", "Stir sticks", "To-go labels"]],
];

async function ensureUser(email: string) {
  const { data: list } = await db.auth.admin.listUsers({ page: 1, perPage: 200 });
  const found = list?.users.find((u) => u.email === email);
  if (found) return found.id;
  const { data, error } = await db.auth.admin.createUser({ email, password: DEMO_PASSWORD, email_confirm: true });
  if (error) throw error;
  return data.user.id;
}

async function main() {
  const products = GROUPS.flatMap(([group, names], g) =>
    names.map((name, i) => ({
      sku: `CSP-${g + 1}${String(i + 1).padStart(2, "0")}`,
      name,
      description: `${group}: ${name}. Sold by the case.`,
      price_cents: 450 + g * 375 + i * 125,
      stripe_price_id: `price_demo_${g + 1}${String(i + 1).padStart(2, "0")}`,
    })),
  );
  const { error: pErr } = await db.from("products").upsert(products, { onConflict: "sku" });
  if (pErr) throw pErr;
  const { data: catalogue } = await db.from("products").select("id, name, price_cents").order("sku");

  for (const org of ORGS) {
    let { data: row } = await db.from("orgs").select("id").eq("name", org.name).maybeSingle();
    if (!row) ({ data: row } = await db.from("orgs").insert({ name: org.name }).select("id").single());
    const orgId = row!.id as string;

    const userIds: string[] = [];
    for (const [prefix, role] of USER_ROLES) {
      const userId = await ensureUser(`${prefix}.${org.slug}@example.com`);
      userIds.push(userId);
      await db.from("profiles").upsert({ user_id: userId, org_id: orgId, role, full_name: `${prefix} ${org.slug}` });
    }

    const { count } = await db.from("orders").select("id", { count: "exact", head: true }).eq("org_id", orgId);
    if ((count ?? 0) > 0) continue;
    for (let n = 0; n < 3; n++) {
      const picks = (catalogue ?? []).slice(n * 3, n * 3 + 3);
      const lines = picks.map((p, i) => ({ product_id: p.id, name: p.name, quantity: i + 1, unit_cents: p.price_cents }));
      const total = lines.reduce((s, l) => s + l.quantity * l.unit_cents, 0);
      const { data: order } = await db
        .from("orders")
        .insert({ org_id: orgId, user_id: userIds[1], status: "paid", total_cents: total })
        .select("id")
        .single();
      await db.from("order_items").insert(
        lines.map((l) => ({ order_id: order!.id, product_id: l.product_id, quantity: l.quantity, unit_cents: l.unit_cents })),
      );
      await db.from("shipments").insert({ order_id: order!.id });
      await db.from("invoices").insert({
        order_id: order!.id,
        org_id: orgId,
        number: invoiceNumber(order!.id),
        body: buildInvoiceText(org.name, order!.id, lines),
      });
    }
  }
  console.log("seed ok: 3 orgs, 12 users, 40 products");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

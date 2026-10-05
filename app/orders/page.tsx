import Link from "next/link";
import { requireAuth } from "@/lib/auth";

export default async function OrdersPage() {
  const auth = await requireAuth();
  const { data: orders } = await auth.db
    .from("orders")
    .select("id, status, total_cents, created_at, invoices(id, number)")
    .eq("org_id", auth.orgId)
    .order("created_at", { ascending: false });
  return (
    <>
      <h1>Order history</h1>
      <table>
        <thead><tr><th>Order</th><th>Status</th><th>Total</th><th>Invoice</th></tr></thead>
        <tbody>
          {(orders ?? []).map((o) => (
            <tr key={o.id} data-testid="order-row" data-status={o.status}>
              <td>{o.id.slice(0, 8)}</td>
              <td>{o.status}</td>
              <td>${(o.total_cents / 100).toFixed(2)}</td>
              <td>
                {(o.invoices as { id: string; number: string }[]).map((inv) => (
                  <Link key={inv.id} href={`/invoices/${inv.id}`}>{inv.number}</Link>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

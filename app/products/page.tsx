import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { AddToCart } from "@/components/AddToCart";

export default async function ProductsPage() {
  const auth = await requireAuth();
  const { data: products } = await auth.db
    .from("products")
    .select("id, sku, name, price_cents")
    .order("name");
  return (
    <>
      <h1>Products</h1>
      <table>
        <thead><tr><th>SKU</th><th>Name</th><th>Price</th><th /></tr></thead>
        <tbody>
          {(products ?? []).map((p) => (
            <tr key={p.id}>
              <td>{p.sku}</td>
              <td><Link href={`/products/${p.id}`}>{p.name}</Link></td>
              <td>${(p.price_cents / 100).toFixed(2)}</td>
              <td><AddToCart productId={p.id} name={p.name} priceCents={p.price_cents} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

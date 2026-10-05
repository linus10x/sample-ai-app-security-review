import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { addNote } from "@/app/actions/notes";
import { NoteList } from "@/components/NoteList";
import { AddToCart } from "@/components/AddToCart";

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireAuth();
  const { data: product } = await auth.db.from("products").select("*").eq("id", id).maybeSingle();
  if (!product) notFound();
  const { data: notes } = await auth.db
    .from("product_notes")
    .select("id, body, created_at")
    .eq("product_id", id)
    .order("created_at", { ascending: false });
  return (
    <>
      <h1>{product.name}</h1>
      <p className="muted">{product.sku} · ${(product.price_cents / 100).toFixed(2)}</p>
      <p>{product.description}</p>
      <AddToCart productId={product.id} name={product.name} priceCents={product.price_cents} />
      <h2>Team notes</h2>
      <NoteList notes={notes ?? []} />
      <form action={addNote} className="stack">
        <input type="hidden" name="productId" value={product.id} />
        <textarea name="body" placeholder="Add a note for your team" required rows={3} />
        <button type="submit">Save note</button>
      </form>
    </>
  );
}

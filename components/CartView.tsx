"use client";

import { useEffect, useState } from "react";
import { readCart, writeCart, type CartLine } from "@/lib/cart";

export function CartView() {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setLines(readCart()), []);

  const total = lines.reduce((s, l) => s + l.unitAmount * l.quantity, 0);

  async function checkout() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        items: lines.map((l) => ({ productId: l.productId, quantity: l.quantity })),
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "Checkout failed");
    writeCart([]);
    window.location.href = data.url;
  }

  if (lines.length === 0) return <p className="muted">Your cart is empty.</p>;
  return (
    <>
      <table>
        <thead><tr><th>Item</th><th>Qty</th><th>Price</th></tr></thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.productId}>
              <td>{l.name}</td>
              <td>{l.quantity}</td>
              <td>${((l.unitAmount * l.quantity) / 100).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p><strong>Total ${(total / 100).toFixed(2)}</strong></p>
      {error && <p className="error" role="alert">{error}</p>}
      <button type="button" disabled={busy} onClick={checkout}>Check out</button>
    </>
  );
}

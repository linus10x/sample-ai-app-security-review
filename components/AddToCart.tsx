"use client";

import { useState } from "react";
import { addToCart } from "@/lib/cart";

export function AddToCart(props: { productId: string; name: string; priceCents: number }) {
  const [added, setAdded] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        addToCart({ productId: props.productId, name: props.name, unitAmount: props.priceCents });
        setAdded(true);
      }}
    >
      {added ? "Added" : "Add to cart"}
    </button>
  );
}

export type CatalogueProduct = { id: string; name: string; price_cents: number; stripe_price_id: string };
export type RequestedItem = { productId: string; quantity: number };
export type PricedLine = {
  productId: string;
  name: string;
  quantity: number;
  unit_cents: number;
  stripe_price_id: string;
};

export class UnknownProductError extends Error {
  constructor(public readonly productId: string) {
    super(`unknown product ${productId}`);
  }
}

/** Price every requested item from the catalogue. The browser never supplies a price. */
export function priceItems(items: RequestedItem[], catalogue: CatalogueProduct[]): { lines: PricedLine[]; total: number } {
  const byId = new Map(catalogue.map((p) => [p.id, p]));
  const lines = items.map((item) => {
    const product = byId.get(item.productId);
    if (!product) throw new UnknownProductError(item.productId);
    return {
      productId: product.id,
      name: product.name,
      quantity: item.quantity,
      unit_cents: product.price_cents,
      stripe_price_id: product.stripe_price_id,
    };
  });
  return { lines, total: lines.reduce((sum, l) => sum + l.unit_cents * l.quantity, 0) };
}

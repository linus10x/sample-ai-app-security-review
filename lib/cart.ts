export type CartLine = { productId: string; name: string; quantity: number; unitAmount: number };

const KEY = "cedar-cart";

export function readCart(): CartLine[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function writeCart(lines: CartLine[]) {
  localStorage.setItem(KEY, JSON.stringify(lines));
}

export function addToCart(line: Omit<CartLine, "quantity">, quantity = 1) {
  const cart = readCart();
  const existing = cart.find((l) => l.productId === line.productId);
  if (existing) existing.quantity += quantity;
  else cart.push({ ...line, quantity });
  writeCart(cart);
}

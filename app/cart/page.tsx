import { requireAuth } from "@/lib/auth";
import { CartView } from "@/components/CartView";

export default async function CartPage() {
  await requireAuth();
  return (
    <>
      <h1>Cart</h1>
      <CartView />
    </>
  );
}

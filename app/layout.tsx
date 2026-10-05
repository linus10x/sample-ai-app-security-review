import "./globals.css";
import Link from "next/link";
import type { ReactNode } from "react";
import { logout } from "@/app/actions/auth";
import { getAuth } from "@/lib/auth";

export const metadata = { title: "Cedar Supply Portal" };

export default async function RootLayout({ children }: { children: ReactNode }) {
  const auth = await getAuth();
  return (
    <html lang="en">
      <body>
        <header className="top">
          <Link href="/" className="brand">Cedar Supply Portal</Link>
          {auth ? (
            <>
              <Link href="/products">Products</Link>
              <Link href="/cart">Cart</Link>
              <Link href="/orders">Orders</Link>
              <Link href="/import">Import</Link>
              {auth.role === "admin" && <Link href="/admin">Admin</Link>}
              <form action={logout}><button type="submit">Sign out</button></form>
            </>
          ) : (
            <>
              <Link href="/login">Sign in</Link>
              <Link href="/signup">Create account</Link>
            </>
          )}
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}

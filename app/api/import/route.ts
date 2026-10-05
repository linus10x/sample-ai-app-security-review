import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { fail } from "@/lib/http";

export async function POST(req: Request) {
  try {
    const auth = await getAuth(req);
    if (!auth) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

    const { url } = await req.json();
    const upstream = await fetch(url);
    const text = await upstream.text();

    let feed: { sku: string; name: string; price_cents: number }[];
    try {
      feed = JSON.parse(text);
    } catch {
      return NextResponse.json({ error: "Feed is not valid JSON", body: text.slice(0, 500) }, { status: 422 });
    }
    return NextResponse.json({ count: feed.length, preview: feed.slice(0, 20) });
  } catch (e) {
    return fail(e);
  }
}

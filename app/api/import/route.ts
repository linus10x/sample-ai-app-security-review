import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { fail } from "@/lib/http";
import { importBody, parseFeed } from "@/lib/import-feed";
import { ImportBlockedError, ImportUpstreamError, parseAllowedHosts, safeFetch } from "@/lib/safe-fetch";

export async function POST(req: Request) {
  try {
    const auth = await getAuth(req);
    if (!auth) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

    const body = importBody.safeParse(await req.json());
    if (!body.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

    let text: string;
    try {
      text = await safeFetch(body.data.url, { allowedHosts: parseAllowedHosts(process.env.IMPORT_ALLOWED_HOSTS) });
    } catch (e) {
      if (e instanceof ImportBlockedError) return NextResponse.json({ error: "That URL is not allowed" }, { status: 400 });
      if (e instanceof ImportUpstreamError) return NextResponse.json({ error: "Could not fetch the feed" }, { status: 502 });
      throw e;
    }

    const feed = parseFeed(text);
    if (!feed) return NextResponse.json({ error: "The feed is not in the expected format" }, { status: 422 });
    return NextResponse.json({ count: feed.length, preview: feed.slice(0, 20) });
  } catch (e) {
    return fail(e);
  }
}

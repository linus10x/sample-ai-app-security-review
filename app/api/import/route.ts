import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { HttpError, readJson, withApi } from "@/lib/http";
import { importBody, parseFeed } from "@/lib/import-feed";
import { ImportBlockedError, ImportUpstreamError, parseAllowedHosts, safeFetch } from "@/lib/safe-fetch";

export const POST = withApi(async (req) => {
  const auth = await getAuth(req);
  if (!auth) throw new HttpError(401, "Not signed in");

  const body = importBody.safeParse(await readJson(req));
  if (!body.success) throw new HttpError(400, "Invalid request");

  let text: string;
  try {
    text = await safeFetch(body.data.url, { allowedHosts: parseAllowedHosts(process.env.IMPORT_ALLOWED_HOSTS) });
  } catch (e) {
    if (e instanceof ImportBlockedError) throw new HttpError(400, "That URL is not allowed");
    if (e instanceof ImportUpstreamError) throw new HttpError(502, "Could not fetch the feed");
    throw e;
  }

  const feed = parseFeed(text);
  if (!feed) throw new HttpError(422, "The feed is not in the expected format");
  return NextResponse.json({ count: feed.length, preview: feed.slice(0, 20) });
});

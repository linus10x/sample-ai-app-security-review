import { describe, expect, it } from "vitest";
import {
  guardedLookup, ImportBlockedError, ImportUpstreamError, isPrivateAddress, parseAllowedHosts, parseImportUrl, safeFetch,
} from "@/lib/safe-fetch";
import { importBody, parseFeed } from "@/lib/import-feed";

describe("isPrivateAddress", () => {
  it.each([
    "127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0",
    "224.0.0.1", "::1", "::", "fe80::1", "fc00::1", "fd12:3456::1", "::ffff:127.0.0.1", "::ffff:7f00:1", "::ffff:10.0.0.1",
    "not-an-ip",
  ])("blocks %s", (ip) => expect(isPrivateAddress(ip)).toBe(true));

  it.each(["93.184.216.34", "8.8.8.8", "172.32.0.1", "2606:4700:4700::1111", "::ffff:8.8.8.8"])("allows %s", (ip) =>
    expect(isPrivateAddress(ip)).toBe(false),
  );
});

describe("parseImportUrl", () => {
  const allowed = ["catalog.example.com"];
  it("accepts an allowlisted https host", () => {
    expect(parseImportUrl("https://Catalog.Example.com/feed.json", allowed).hostname).toBe("catalog.example.com");
  });
  it.each([
    ["http scheme", "http://catalog.example.com/feed.json"],
    ["file scheme", "file:///etc/passwd"],
    ["host not on the list", "https://evil.example.net/feed.json"],
    ["loopback literal", "https://127.0.0.1/feed.json"],
    ["ipv6 loopback", "https://[::1]/feed.json"],
    ["metadata address", "https://169.254.169.254/latest/meta-data"],
    ["credentials", "https://user:pw@catalog.example.com/feed.json"],
    ["odd port", "https://catalog.example.com:8443/feed.json"],
    ["not a url", "catalog.example.com/feed.json"],
  ])("blocks %s", (_name, url) => {
    expect(() => parseImportUrl(url, allowed)).toThrow(ImportBlockedError);
  });
  it("blocks everything when the allowlist is empty", () => {
    expect(() => parseImportUrl("https://catalog.example.com/x", parseAllowedHosts(undefined))).toThrow(ImportBlockedError);
    expect(parseAllowedHosts(" A.example.com, ,b.example.com ")).toEqual(["a.example.com", "b.example.com"]);
  });
});

describe("guardedLookup", () => {
  const resolver = (addrs: { address: string; family: number }[], err: NodeJS.ErrnoException | null = null) =>
    ((_h: string, _o: unknown, cb: (e: NodeJS.ErrnoException | null, a: typeof addrs) => void) => cb(err, addrs)) as never;

  it("passes a public address through, in both callback shapes", () => {
    const lookup = guardedLookup(resolver([{ address: "93.184.216.34", family: 4 }]));
    lookup("catalog.example.com", {}, (e, a, f) => { expect(e).toBeNull(); expect(a).toBe("93.184.216.34"); expect(f).toBe(4); });
    lookup("catalog.example.com", { all: true }, (e, a) => { expect(e).toBeNull(); expect(a).toEqual([{ address: "93.184.216.34", family: 4 }]); });
  });
  it("refuses a name that resolves to a private address, even next to a public one", () => {
    const lookup = guardedLookup(resolver([{ address: "93.184.216.34", family: 4 }, { address: "10.0.0.5", family: 4 }]));
    lookup("rebind.example.com", {}, (e) => expect(e).toBeInstanceOf(ImportBlockedError));
  });
  it("passes resolver errors and empty answers on as failures", () => {
    guardedLookup(resolver([], Object.assign(new Error("nxdomain"), { code: "ENOTFOUND" })))("x", {}, (e) => expect(e).toBeTruthy());
    guardedLookup(resolver([]))("x", {}, (e) => expect(e).toBeInstanceOf(ImportBlockedError));
  });
});

describe("safeFetch", () => {
  const allowedHosts = ["catalog.example.com"];
  const url = "https://catalog.example.com/feed.json";
  const reply = (body: string, init: ResponseInit = {}) => async () => new Response(body, init);

  it("returns the body of a normal response and does not follow redirects", async () => {
    let seen: Record<string, unknown> = {};
    const fetchImpl = async (_u: string, init: Record<string, unknown>) => { seen = init; return new Response("[]"); };
    expect(await safeFetch(url, { allowedHosts, fetchImpl })).toBe("[]");
    expect(seen.redirect).toBe("manual");
    expect(seen.signal).toBeInstanceOf(AbortSignal);
  });
  it("treats a redirect as a failure", async () => {
    await expect(safeFetch(url, { allowedHosts, fetchImpl: reply("", { status: 302, headers: { location: "http://127.0.0.1/" } }) })).rejects.toBeInstanceOf(ImportUpstreamError);
  });
  it("treats an error status as a failure", async () => {
    await expect(safeFetch(url, { allowedHosts, fetchImpl: reply("no", { status: 500 }) })).rejects.toBeInstanceOf(ImportUpstreamError);
  });
  it("rejects a feed that is too large by header and by streaming", async () => {
    await expect(safeFetch(url, { allowedHosts, maxBytes: 10, fetchImpl: reply("x", { headers: { "content-length": "999" } }) })).rejects.toThrow("too large");
    await expect(safeFetch(url, { allowedHosts, maxBytes: 10, fetchImpl: reply("x".repeat(50)) })).rejects.toThrow("too large");
  });
  it("maps a network failure to an upstream error and keeps a blocked address a blocked error", async () => {
    await expect(safeFetch(url, { allowedHosts, fetchImpl: async () => { throw new Error("boom"); } })).rejects.toBeInstanceOf(ImportUpstreamError);
    const blockedByLookup = async () => { throw Object.assign(new TypeError("fetch failed"), { cause: new ImportBlockedError("x") }); };
    await expect(safeFetch(url, { allowedHosts, fetchImpl: blockedByLookup })).rejects.toBeInstanceOf(ImportBlockedError);
  });
  it("never calls out for a URL that fails validation", async () => {
    let called = false;
    const fetchImpl = async () => { called = true; return new Response("[]"); };
    await expect(safeFetch("http://127.0.0.1/", { allowedHosts, fetchImpl })).rejects.toBeInstanceOf(ImportBlockedError);
    expect(called).toBe(false);
  });
  it("returns an empty string for a response with no body", async () => {
    expect(await safeFetch(url, { allowedHosts, fetchImpl: async () => new Response(null, { status: 204 }) })).toBe("");
  });
});

describe("feed parsing", () => {
  it("accepts a valid feed and rejects bad JSON or wrong shapes", () => {
    expect(parseFeed('[{"sku":"A","name":"Napkins","price_cents":450}]')).toHaveLength(1);
    expect(parseFeed("not json")).toBeNull();
    expect(parseFeed('[{"sku":"A","name":"Napkins","price_cents":-1}]')).toBeNull();
    expect(parseFeed('{"sku":"A"}')).toBeNull();
  });
  it("validates the request body", () => {
    expect(importBody.safeParse({ url: "https://a.example.com" }).success).toBe(true);
    expect(importBody.safeParse({}).success).toBe(false);
  });
});

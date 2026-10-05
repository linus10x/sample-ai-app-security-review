import { BlockList, isIP } from "node:net";
import dns from "node:dns";
import { Agent, fetch as undiciFetch } from "undici";

export class ImportBlockedError extends Error {}
export class ImportUpstreamError extends Error {}

const blocked = new BlockList();
const V4: [string, number][] = [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16],
  ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15],
  ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
];
const V6: [string, number][] = [["::", 128], ["::1", 128], ["fc00::", 7], ["fe80::", 10], ["ff00::", 8], ["2001:db8::", 32]];
V4.forEach(([net, prefix]) => blocked.addSubnet(net, prefix, "ipv4"));
V6.forEach(([net, prefix]) => blocked.addSubnet(net, prefix, "ipv6"));

/** Expand an IPv6 address to its eight 16-bit groups. */
function groups(address: string): number[] {
  let text = address.toLowerCase();
  const tail = text.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (tail) {
    const [a, b, c, d] = tail[1].split(".").map(Number);
    text = text.slice(0, -tail[1].length) + ((a << 8) | b).toString(16) + ":" + ((c << 8) | d).toString(16);
  }
  const [head, rest] = text.split("::");
  const left = head ? head.split(":") : [];
  const right = rest === undefined ? [] : rest ? rest.split(":") : [];
  const fill = rest === undefined ? [] : Array(8 - left.length - right.length).fill("0");
  return [...left, ...fill, ...right].map((g) => parseInt(g || "0", 16));
}

/** True for loopback, private, link-local, reserved and IPv4-mapped versions of those. */
export function isPrivateAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return blocked.check(address, "ipv4");
  if (family === 6) {
    const g = groups(address);
    const mapped = g.slice(0, 5).every((x) => x === 0) && g[5] === 0xffff;
    if (mapped) return blocked.check(`${g[6] >> 8}.${g[6] & 255}.${g[7] >> 8}.${g[7] & 255}`, "ipv4");
    return blocked.check(address, "ipv6");
  }
  return true; // not an IP at all: never treat it as safe
}

export function parseAllowedHosts(raw: string | undefined): string[] {
  return (raw ?? "").split(",").map((h) => h.trim().toLowerCase()).filter(Boolean);
}

/** Only https, no credentials, default port, and a host from the allowlist. */
export function parseImportUrl(raw: string, allowedHosts: string[]): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ImportBlockedError("not a valid URL");
  }
  if (url.protocol !== "https:") throw new ImportBlockedError("only https is allowed");
  if (url.username || url.password) throw new ImportBlockedError("credentials in URLs are not allowed");
  if (url.port && url.port !== "443") throw new ImportBlockedError("only the default port is allowed");
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (isIP(host) && isPrivateAddress(host)) throw new ImportBlockedError("private address");
  if (!allowedHosts.includes(host)) throw new ImportBlockedError("host is not on the allowlist");
  return url;
}

type LookupOptions = { all?: boolean; family?: number };
type LookupCallback = (err: Error | null, address: string | dns.LookupAddress[], family?: number) => void;
type Resolver = (hostname: string, options: dns.LookupAllOptions, cb: (err: NodeJS.ErrnoException | null, addrs: dns.LookupAddress[]) => void) => void;

/** DNS lookup that refuses to hand back a private address, checked at connect time. */
export function guardedLookup(resolve: Resolver = dns.lookup as unknown as Resolver) {
  return (hostname: string, options: LookupOptions, cb: LookupCallback) => {
    resolve(hostname, { all: true, family: options.family } as dns.LookupAllOptions, (err, addrs) => {
      if (err) return cb(err, "");
      if (addrs.length === 0 || addrs.some((a) => isPrivateAddress(a.address))) {
        return cb(new ImportBlockedError("host resolves to a private address"), "");
      }
      if (options.all) return cb(null, addrs);
      cb(null, addrs[0].address, addrs[0].family);
    });
  };
}

export type SafeFetchOptions = {
  allowedHosts: string[];
  timeoutMs?: number;
  maxBytes?: number;
  fetchImpl?: (url: string, init: Record<string, unknown>) => Promise<Response>;
};

export async function safeFetch(raw: string, opts: SafeFetchOptions): Promise<string> {
  const url = parseImportUrl(raw, opts.allowedHosts);
  const maxBytes = opts.maxBytes ?? 1_000_000;
  const doFetch =
    opts.fetchImpl ??
    ((u: string, init: Record<string, unknown>) =>
      undiciFetch(u, { ...init, dispatcher: new Agent({ connect: { lookup: guardedLookup() as never } }) } as never) as unknown as Promise<Response>);

  let res: Response;
  try {
    res = await doFetch(url.toString(), {
      redirect: "manual",
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(opts.timeoutMs ?? 5000),
    });
  } catch (e) {
    const cause = (e as { cause?: unknown }).cause;
    if (e instanceof ImportBlockedError || cause instanceof ImportBlockedError) {
      throw new ImportBlockedError("host resolves to a private address");
    }
    throw new ImportUpstreamError("request failed");
  }
  if (res.status >= 300 && res.status < 400) throw new ImportUpstreamError("redirects are not followed");
  if (!res.ok) throw new ImportUpstreamError(`upstream returned ${res.status}`);
  const declared = Number(res.headers.get("content-length") ?? 0);
  if (declared > maxBytes) throw new ImportUpstreamError("feed is too large");

  const reader = res.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new ImportUpstreamError("feed is too large");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

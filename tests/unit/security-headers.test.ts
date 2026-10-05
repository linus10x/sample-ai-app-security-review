import { describe, expect, it } from "vitest";
import { contentSecurityPolicy, securityHeaders } from "@/lib/security-headers";

describe("security headers", () => {
  const map = Object.fromEntries(securityHeaders(false)[0].headers.map((h) => [h.key, h.value]));

  it("applies to every path", () => {
    expect(securityHeaders()[0].source).toBe("/:path*");
  });
  it("sets the standard protective headers", () => {
    expect(map["Strict-Transport-Security"]).toMatch(/max-age=63072000/);
    expect(map["X-Content-Type-Options"]).toBe("nosniff");
    expect(map["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(map["X-Frame-Options"]).toBe("DENY");
    expect(map["Permissions-Policy"]).toContain("camera=()");
  });
  it("locks the policy down: same origin by default, no framing, no plugins", () => {
    const csp = contentSecurityPolicy(false);
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).not.toContain("unsafe-eval");
  });
  it("only allows eval in development", () => {
    expect(contentSecurityPolicy(true)).toContain("'unsafe-eval'");
  });
});

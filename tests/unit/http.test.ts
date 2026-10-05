import { afterEach, describe, expect, it, vi } from "vitest";
import { dbError, fail, HttpError, jsonError, readJson, withApi } from "@/lib/http";

afterEach(() => vi.restoreAllMocks());

describe("fail", () => {
  it("shows an HttpError message and a correlation id, and logs nothing", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = fail(new HttpError(400, "Invalid request"), "abc-123");
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid request", correlationId: "abc-123" });
    expect(res.headers.get("x-correlation-id")).toBe("abc-123");
    expect(log).not.toHaveBeenCalled();
  });

  it("hides everything else behind a generic message and logs the detail with the same id", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const boom = Object.assign(new Error('invalid input syntax for type uuid: "x"'), { code: "22P02", query: "select * from products" });
    const res = fail(boom, "id-9");
    const text = await res.text();
    expect(res.status).toBe(500);
    expect(JSON.parse(text)).toEqual({ error: "Something went wrong", correlationId: "id-9" });
    expect(text).not.toMatch(/invalid input|select|stack|22P02/);
    const entry = JSON.parse(log.mock.calls[0][0] as string);
    expect(entry).toMatchObject({ correlationId: "id-9", code: "22P02", query: "select * from products" });
    expect(entry.message).toContain("invalid input syntax");
    expect(entry.stack).toContain("Error");
  });

  it("copes with a thrown value that is not an Error, and makes an id when none is given", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = fail("plain string");
    expect((await res.json()).correlationId).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe("withApi", () => {
  it("passes a normal response through", async () => {
    const res = await withApi(async () => new Response("ok"))(new Request("http://x"));
    expect(await res.text()).toBe("ok");
  });
  it("turns a throw into the safe error response", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await withApi(async () => { throw new Error("secret detail"); })(new Request("http://x"));
    expect(res.status).toBe(500);
    expect(await res.text()).not.toContain("secret detail");
  });
});

describe("helpers", () => {
  it("readJson turns a parse failure into a clean 400", async () => {
    await expect(readJson(new Request("http://x", { method: "POST", body: "{nope" }))).rejects.toMatchObject({ status: 400 });
    expect(await readJson(new Request("http://x", { method: "POST", body: '{"a":1}' }))).toEqual({ a: 1 });
  });
  it("dbError keeps the statement for the log", () => {
    expect(dbError({ message: "m" }, "select 1")).toMatchObject({ message: "m", query: "select 1" });
  });
  it("jsonError sets the header", () => {
    expect(jsonError(404, "nope", "cid").headers.get("x-correlation-id")).toBe("cid");
  });
});

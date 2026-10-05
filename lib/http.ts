import { NextResponse } from "next/server";

/** An error whose message is safe to show the caller. Everything else becomes a generic 500. */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly publicMessage: string,
  ) {
    super(publicMessage);
  }
}

export function newCorrelationId(): string {
  return crypto.randomUUID();
}

export function jsonError(status: number, message: string, correlationId: string) {
  return NextResponse.json({ error: message, correlationId }, { status, headers: { "x-correlation-id": correlationId } });
}

/** Full detail goes to the server log, keyed by the correlation id. Never to the browser. */
export function logServerError(correlationId: string, e: unknown) {
  const err = e instanceof Error ? e : new Error(String(e));
  const extra = e as { details?: string; hint?: string; code?: string; query?: string };
  console.error(
    JSON.stringify({
      level: "error",
      correlationId,
      message: err.message,
      stack: err.stack,
      code: extra.code,
      details: extra.details,
      hint: extra.hint,
      query: extra.query,
    }),
  );
}

export function fail(e: unknown, correlationId: string = newCorrelationId()) {
  if (e instanceof HttpError) return jsonError(e.status, e.publicMessage, correlationId);
  logServerError(correlationId, e);
  return jsonError(500, "Something went wrong", correlationId);
}

/** Wrap a route handler so every failure takes the same safe path. */
export function withApi(handler: (req: Request) => Promise<Response>) {
  return async (req: Request): Promise<Response> => {
    const correlationId = newCorrelationId();
    try {
      return await handler(req);
    } catch (e) {
      return fail(e, correlationId);
    }
  };
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new HttpError(400, "Request body must be valid JSON");
  }
}

/** Attach the statement to an error for the server log. The statement is never sent to a client. */
export function dbError(error: { message: string }, query: string): Error {
  return Object.assign(new Error(error.message), { query });
}

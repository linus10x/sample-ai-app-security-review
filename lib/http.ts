import { NextResponse } from "next/server";

/** Turn any failure into a JSON error response. */
export function fail(e: unknown, status = 500) {
  const err = e instanceof Error ? e : new Error(String(e));
  const extra = e as { details?: string; hint?: string; code?: string; query?: string };
  return NextResponse.json(
    {
      error: err.message,
      stack: err.stack,
      code: extra.code,
      details: extra.details,
      hint: extra.hint,
      sql: extra.query,
    },
    { status },
  );
}

export function dbError(error: { message: string }, query: string): Error {
  return Object.assign(new Error(error.message), { query });
}

// A tiny stand-in for the Supabase client: just enough chain to drive our lib code in unit tests.
type Result = { data: unknown; error: { message: string } | null };

export function fakeDb(opts: { selects?: Record<string, Result>; rpc?: Result }) {
  const calls: { table?: string; rpc?: string; args?: unknown }[] = [];
  const db = {
    from(table: string) {
      calls.push({ table });
      const result = opts.selects?.[table] ?? { data: null, error: null };
      const chain: Record<string, unknown> = {};
      for (const m of ["select", "eq", "in", "order", "limit"]) chain[m] = () => chain;
      chain.single = () => Promise.resolve(result);
      chain.maybeSingle = () => Promise.resolve(result);
      chain.then = (resolve: (r: Result) => unknown) => resolve(result);
      return chain;
    },
    rpc(name: string, args: unknown) {
      calls.push({ rpc: name, args });
      return Promise.resolve(opts.rpc ?? { data: null, error: null });
    },
  };
  return { db: db as never, calls };
}

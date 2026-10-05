import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

/** Supabase client that acts as the signed-in user (anon key + the user's JWT). */
export async function createUserClient(): Promise<SupabaseClient> {
  const store = await cookies();
  return createServerClient(env.supabaseUrl(), env.anonKey(), {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (all) => {
        try {
          all.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // called from a Server Component: cookies are read-only there
        }
      },
    },
  });
}

/** Same, but for API clients that send `Authorization: Bearer <jwt>`. */
export function createBearerClient(token: string): SupabaseClient {
  return createClient(env.supabaseUrl(), env.anonKey(), {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

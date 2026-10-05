import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

/** Service role client. Bypasses row level security, so it only runs on the server. */
export function createAdminClient(): SupabaseClient {
  return createClient(env.supabaseUrl(), env.serviceKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

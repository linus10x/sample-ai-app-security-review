import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

/** Service role client. Bypasses row level security. */
export function createAdminClient(): SupabaseClient {
  return createClient(env.supabaseUrl(), env.serviceKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

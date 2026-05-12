// Service-role Supabase client.  ONLY use from trusted server code (server
// actions, route handlers) where you've already authenticated the user and
// need to bypass RLS for a specific privileged write (e.g. closing an
// auction on Buy-Now).  Never import this from a Client Component.
import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) {
    throw new Error("Missing Supabase URL or service-role key for admin client.");
  }
  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

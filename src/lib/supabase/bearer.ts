import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Request-scoped Supabase client authenticated as the mobile user via their
// `Authorization: Bearer <access_token>` header. Uses the public anon key (valid
// on prod) + the user's token, so EVERY query is RLS-scoped to that user — no
// service-role key needed (the deployed service-role key was found stale, which
// made admin.auth.getUser(token) 401 even for valid tokens). Returns null if no
// bearer token is present.
export function createBearerClient(authHeader: string | null | undefined): SupabaseClient | null {
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  return createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

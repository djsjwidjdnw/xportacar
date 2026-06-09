// Resolve the calling user from their Supabase JWT. The platform also verifies
// the JWT at the gateway by default (functions are deployed with verify_jwt on),
// so this is defence-in-depth plus a way to get the user id for rate limiting.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export async function getUserId(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return null;
    return data.user.id;
  } catch {
    return null;
  }
}

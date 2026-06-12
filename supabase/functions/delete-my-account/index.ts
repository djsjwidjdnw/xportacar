// delete-my-account — authenticated self-service account deletion (Apple
// Guideline 5.1.1(v)). Called by the mobile apps via
// supabase.functions.invoke("delete-my-account"), and by the web app's
// deleteMyAccountAction (which forwards the user's JWT).
//
// Flow (no admin override — a user can only delete THEIR OWN account):
//   1. Validate the caller's JWT → resolve the user.
//   2. Capture email + name + language BEFORE deletion (for the final email).
//   3. Call the delete_my_account() RPC as the user (scrubs/deletes all their
//      data, anonymizes invoices, deletes the profile row).
//   4. Service role: delete the auth.users row (RPC can't).
//   5. Send the localized "account deleted" email via the web internal route.
//
// Deploy:  supabase functions deploy delete-my-account
//   (keep verify_jwt ON — this MUST be authenticated)
// Uses auto-injected SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY
// plus SITE_URL + CRON_SECRET (already set) for the confirmation email.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
  const ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  // User-scoped client — RPC runs with the caller's auth.uid().
  const userClient = createClient(SUPABASE_URL, ANON, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: userErr } = await userClient.auth.getUser();
  if (userErr || !user) return json({ error: "unauthorized" }, 401);

  // Capture identity BEFORE deletion (profile row is about to be removed).
  let email: string | null = user.email ?? null;
  let name = "";
  let locale: string | undefined;
  try {
    const { data: profile } = await userClient
      .from("profiles").select("email, full_name, language").eq("id", user.id).single();
    const p = profile as { email?: string; full_name?: string; language?: string } | null;
    if (p?.email) email = p.email;
    name = p?.full_name ?? "";
    locale = p?.language ?? undefined;
  } catch { /* fall back to auth email */ }

  // 1) Scrub + delete the user's data (anonymizes invoices, deletes profile).
  const { data: rpcData, error: rpcErr } = await userClient.rpc("delete_my_account");
  if (rpcErr) {
    console.error("delete-my-account: rpc failed", rpcErr.message);
    return json({ error: "deletion_failed", detail: rpcErr.message }, 500);
  }

  // 2) Delete the auth.users row (requires the service role).
  const admin = createClient(SUPABASE_URL, SERVICE);
  const { error: authDelErr } = await admin.auth.admin.deleteUser(user.id);
  if (authDelErr) {
    // Data is already scrubbed/deleted; surface so a retry can finish the auth
    // row removal. Re-invoking is safe (RPC is idempotent).
    console.error("delete-my-account: auth delete failed", authDelErr.message);
    return json({ error: "auth_delete_failed", detail: authDelErr.message }, 500);
  }

  // 3) Final confirmation email (best-effort — never fails the deletion).
  try {
    const SITE = (Deno.env.get("SITE_URL") ?? "https://xportacar.com").replace(/\/$/, "");
    const secret = Deno.env.get("CRON_SECRET") ?? "";
    if (email && secret) {
      await fetch(`${SITE}/api/internal/notify`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-cron-secret": secret },
        body: JSON.stringify({
          kind: "account_deleted",
          to: email,
          name,
          locale,
          dateStr: new Date().toISOString().slice(0, 10),
        }),
      });
    }
  } catch (e) {
    console.error("delete-my-account: confirmation email failed", (e as Error)?.message);
  }

  return json({ ok: true, rpc: rpcData });
});

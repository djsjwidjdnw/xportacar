// notify-watchlist-matches — cron Edge Function (every 30 min). Scans vehicles
// that became 'listed' in the last ~35 min and emails users whose SAVED SEARCH
// matches, max 1 watchlist email per user per day.
//
// Matching (conservative, anti-spam): a saved_searches.filters row matches a
// vehicle if its `make` equals the vehicle make (case-insensitive) OR its `q`
// free-text appears in "{year} {make} {model}". Searches with neither are
// skipped (too broad). The actual email is sent (branded + localized) by the
// web app's /api/internal/notify route — we just decide who + dedup.
//
// Deploy:  supabase functions deploy notify-watchlist-matches --no-verify-jwt
// Secrets: supabase secrets set CRON_SECRET=<secret>  SITE_URL=https://xportacar.com
// Schedule: see the pg_cron SQL in the batch notes (every 30 min).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const secret = Deno.env.get("CRON_SECRET") ?? "";
  if (!secret || req.headers.get("x-cron-secret") !== secret) {
    return json({ error: "unauthorized" }, 401);
  }
  const SITE = (Deno.env.get("SITE_URL") ?? "https://xportacar.com").replace(/\/$/, "");
  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  const sinceIso = new Date(Date.now() - 35 * 60 * 1000).toISOString();

  // Newly-listed vehicles (updated into 'listed' in the window). updated_at is
  // bumped by the set_updated_at trigger when status flips.
  const { data: vehicles, error } = await admin
    .from("vehicles")
    .select("id, make, model, year, listed_price_eur, buy_now_price_eur")
    .eq("status", "listed")
    .gte("updated_at", sinceIso);
  if (error) return json({ error: error.message }, 500);
  if (!vehicles || vehicles.length === 0) return json({ ok: true, vehicles: 0, sent: 0 });

  // All saved searches + their owners' email/language.
  const { data: searches } = await admin
    .from("saved_searches")
    .select("user_id, filters, profiles:profiles!user_id ( email, language )");

  const dayAgoIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  let sent = 0;
  const emailedThisRun = new Set<string>();

  for (const v of vehicles) {
    const title = `${v.year} ${v.make} ${v.model}`;
    for (const s of (searches ?? []) as SavedSearch[]) {
      const f = (s.filters ?? {}) as Record<string, string>;
      const makeMatch = f.make && String(f.make).toLowerCase() === String(v.make).toLowerCase();
      const qMatch = f.q && title.toLowerCase().includes(String(f.q).toLowerCase());
      if (!makeMatch && !qMatch) continue;

      const prof = Array.isArray(s.profiles) ? s.profiles[0] : s.profiles;
      const to = prof?.email;
      if (!to || emailedThisRun.has(s.user_id)) continue;

      // Rate limit: max 1 watchlist email per user per day.
      const { data: recent } = await admin
        .from("automated_email_log")
        .select("id")
        .eq("user_id", s.user_id)
        .eq("kind", "watchlist_match")
        .gte("sent_at", dayAgoIso)
        .limit(1);
      if (recent && recent.length > 0) { emailedThisRun.add(s.user_id); continue; }

      const price = v.buy_now_price_eur ?? v.listed_price_eur ?? null;
      const ok = await postEmail(SITE, secret, {
        kind: "watchlist_match", to, locale: prof?.language ?? undefined,
        vehicleTitle: title, vehicleId: v.id, priceEur: price ?? undefined,
      });
      if (ok) {
        await admin.from("automated_email_log").insert({ user_id: s.user_id, kind: "watchlist_match", ref_id: v.id });
        emailedThisRun.add(s.user_id);
        sent++;
      }
    }
  }

  console.log(`notify-watchlist-matches: vehicles=${vehicles.length} sent=${sent}`);
  return json({ ok: true, vehicles: vehicles.length, sent });
});

interface SavedSearch {
  user_id: string;
  filters: Record<string, string> | null;
  profiles: { email?: string | null; language?: string | null } | { email?: string | null; language?: string | null }[] | null;
}

async function postEmail(site: string, secret: string, payload: Record<string, unknown>): Promise<boolean> {
  try {
    const res = await fetch(`${site}/api/internal/notify`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-cron-secret": secret },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch (e) {
    console.error("notify-watchlist-matches: post failed", (e as Error)?.message);
    return false;
  }
}

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });
}

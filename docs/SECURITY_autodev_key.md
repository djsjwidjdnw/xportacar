# Security remediation — leaked auto.dev API key

## What happened
A **private** auto.dev API key (prefix `sk_ad_…`) was hardcoded in the two
mobile repos:

- `xportacar-mobile/src/lib/valuation.ts` → `DEFAULT_API_KEY`
- `xportacar-inspection/src/lib/valuation.ts` → `DEFAULT_API_KEY`
  (also imported by `xportacar-inspection/src/lib/vinDecoder.ts` for VIN decode)

Because everything in a React-Native / Expo bundle ships to the device, the key
is extractable by anyone who downloads the app, and it is already in **git
history** (committed). Unlike the Supabase *publishable* anon key (public by
design), `sk_ad_` is a secret and must never live in a client.

Impact: a third party can exhaust the account's auto.dev quota / run up billing.

## Step 1 — Rotate now (mandatory, human action)
Rotating is the only thing that neutralises the already-leaked key; removing it
from source does **not** un-leak history.

1. Log in to auto.dev → API keys → **revoke** `sk_ad_qp5H-…` and issue a new key.
2. Do **not** put the new key in any client repo. It goes server-side only.

After rotation the embedded key is dead, so the mobile valuation/VIN features
fall back to their offline behaviour (reference-table estimate / manual VIN
entry) until the proxy below is in place.

## Step 2 — Proxy the API server-side (recommended: Supabase Edge Function)
The mobile apps already talk to Supabase directly and carry the user's JWT, so a
Supabase Edge Function is the lowest-friction proxy (no new base URL, auth for
free). The web app already keeps the key server-side
(`xportacar/src/lib/valuation-server.ts`, `process.env.VALUATION_API_KEY`).

### 2a. Create the function `supabase/functions/market-proxy/index.ts`
```ts
// Deno Edge Function. Deploy:  supabase functions deploy market-proxy
// Set the secret:  supabase secrets set AUTODEV_API_KEY=sk_ad_<rotated>
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const KEY = Deno.env.get("AUTODEV_API_KEY") ?? "";

serve(async (req) => {
  // Supabase injects the caller's JWT; require a signed-in user.
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);
  if (!KEY) return json({ error: "not configured" }, 503);

  const body = await req.json().catch(() => ({}));
  try {
    if (body.action === "vin" && body.vin) {
      const r = await fetch(
        `https://api.auto.dev/vin/${encodeURIComponent(body.vin)}`,
        { headers: { Authorization: `Bearer ${KEY}`, Accept: "application/json" } },
      );
      return json(await r.json(), r.ok ? 200 : r.status);
    }
    if (body.action === "valuation" && body.make && body.model && body.year) {
      const qs = new URLSearchParams({
        make: body.make, model: body.model,
        year_min: String(body.year), year_max: String(body.year),
      });
      const r = await fetch(`https://auto.dev/api/listings?${qs}`, {
        headers: { Authorization: `Bearer ${KEY}`, Accept: "application/json" },
      });
      return json(await r.json(), r.ok ? 200 : r.status);
    }
    return json({ error: "bad request" }, 400);
  } catch (e) {
    return json({ error: String(e) }, 502);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status, headers: { "Content-Type": "application/json" },
  });
}
```

### 2b. Update the mobile apps to call it (remove the embedded key)
In **both** `valuation.ts` files: delete `DEFAULT_API_KEY`, and rewrite
`getMarketValuation` to invoke the function, keeping the offline fallback:
```ts
import { supabase } from "./supabase";

export async function getMarketValuation(input: ValuationInput): Promise<Valuation> {
  try {
    const { data } = await supabase.functions.invoke("market-proxy", {
      body: { action: "valuation", make: input.make, model: input.model, year: input.year },
    });
    const live = parseListings(data, input); // reuse the price-aggregation logic
    if (live) return live;
  } catch { /* fall through */ }
  return estimateValuation(input);
}
```
In `xportacar-inspection/src/lib/vinDecoder.ts`: drop
`import { DEFAULT_API_KEY }`, and fetch via
`supabase.functions.invoke("market-proxy", { body: { action: "vin", vin } })`,
then run the existing defensive parser on the returned JSON. Both paths already
degrade gracefully (estimate / manual entry) if the function is unavailable —
so this is safe to ship before the function is deployed.

These mobile changes are JS-only → shippable as an EAS OTA update (see each
repo's `docs/OTA_UPDATES.md`), but they are **not** in the current TestFlight
builds.

## Alternative — Next.js API route
If you'd rather not use Edge Functions, add `src/app/api/market/route.ts` to the
web app (validate the Supabase session via `createClient().auth.getUser()`, call
`getVehicleValuation` / auto.dev with `process.env.VALUATION_API_KEY`), expose a
public base URL to the apps (e.g. `extra.apiBaseUrl` in `app.json`), and have
the mobile code `fetch` it with the user's access token. Same graceful fallback.

## Checklist
- [ ] Rotate the auto.dev key (revoke old, issue new).
- [ ] Deploy the proxy (Edge Function or API route) + set `AUTODEV_API_KEY` /
      `VALUATION_API_KEY` as a server secret.
- [ ] Remove `DEFAULT_API_KEY` from both mobile `valuation.ts`; update
      `vinDecoder.ts`.
- [ ] Ship the mobile change (OTA or next build).
- [ ] Confirm VIN decode + valuation still work end-to-end.

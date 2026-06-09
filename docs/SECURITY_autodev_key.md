# Security — auto.dev API key (rotated + moved server-side)

**Status: RESOLVED (2026-06-09).** The key was rotated and the mobile apps no
longer contain it — they call Supabase Edge Functions that hold the key
server-side.

> ⚠️ The live key value is intentionally **not** written in this file (this doc
> is committed to git; putting the key here would re-leak it). The rotated key
> lives only in: Supabase Function secrets, Vercel env vars, and each
> developer's gitignored `.env.local`.

## What happened
A **private** auto.dev key (`sk_ad_qp5H-…`, now **revoked**) was hardcoded in
`xportacar-mobile/src/lib/valuation.ts` and `xportacar-inspection/src/lib/
valuation.ts` (the latter also used by `vinDecoder.ts`). Anything in an Expo
bundle ships to the device and is extractable, and the value is in git history.
Rotating the key neutralised the exposure.

## What was done

### 1. Rotated (manual)
The old `sk_ad_qp5H-…` key was revoked at auto.dev and a new key issued. The new
key is **not** stored in any committed file.

### 2. Two Supabase Edge Functions (the proxy)
`supabase/functions/` (web repo):

| Function | Body | Calls |
|----------|------|-------|
| `valuation-proxy`  | `{ make, model, year, trim?, mileage? }` | auto.dev listings API |
| `vin-decoder-proxy`| `{ vin }` (validated 17 chars) | auto.dev VIN API |

Both: require a valid Supabase JWT (`verify_jwt` on by default + an in-function
`getUser` check), send CORS headers + answer OPTIONS (for the inspector web
export), apply best-effort per-user rate limiting (`_shared/rateLimit.ts`), read
the key from `Deno.env.get("AUTODEV_API_KEY")`, and **never** return or log the
key. Shared helpers live in `supabase/functions/_shared/`.

### 3. Mobile apps call the proxy (key removed)
- `xportacar-mobile/src/lib/valuation.ts` and
  `xportacar-inspection/src/lib/valuation.ts`: `DEFAULT_API_KEY` deleted;
  `getMarketValuation()` now calls `supabase.functions.invoke("valuation-proxy", …)`
  and aggregates the result, falling back to the offline `estimateValuation()`.
- `xportacar-inspection/src/lib/vinDecoder.ts`: no longer imports the key;
  `decodeVin()` calls `supabase.functions.invoke("vin-decoder-proxy", …)`,
  falling back to manual entry on any failure.
- UX is unchanged (same graceful fallbacks). Call-site signatures
  (`getMarketValuation(input)`, `decodeVin(vin)`) are unchanged.

### 4. Web app
Already server-side: `src/lib/valuation-server.ts` (`"server-only"`) reads
`process.env.VALUATION_API_KEY ?? process.env.AUTODEV_API_KEY` and is only
called from server components. No browser code path touches auto.dev, so no web
code change was needed — just the env var.

## Commands to run (manual)

```bash
# From the web repo (xportacar/), with the Supabase CLI linked to the project:

# 1. Set the key as a Function secret (used by BOTH functions):
supabase secrets set AUTODEV_API_KEY=sk_ad_<ROTATED_KEY>

# 2. Deploy the two functions:
supabase functions deploy valuation-proxy
supabase functions deploy vin-decoder-proxy
```
(`SUPABASE_URL` / `SUPABASE_ANON_KEY` are injected into functions automatically;
no need to set them.)

## Env vars

- **Local dev:** `xportacar/.env.local` (gitignored) — `AUTODEV_API_KEY` and
  `VALUATION_API_KEY` both set to the rotated key.
- **Vercel (production):** add **`AUTODEV_API_KEY`** (and/or `VALUATION_API_KEY`)
  = the rotated key under Project → Settings → Environment Variables. Never use
  `NEXT_PUBLIC_` for this — it must stay server-side only.
- **Supabase:** `AUTODEV_API_KEY` set via `supabase secrets set` (above).

## Git history
The old key `sk_ad_qp5H-…` remains in git history. We **considered** rewriting
history with `git filter-repo` / BFG and **chose not to**: the old key is
already revoked (so history exposure is no longer a live risk), and a rewrite
would change every commit hash and break all existing clones/forks/checkouts for
no security benefit. The rotation is the fix; history rewrite is unnecessary.

## Verification
- `sk_ad_…` (new key) appears in **no** committed file — only in gitignored
  `.env.local`, Supabase secrets, and Vercel env.
- The functions read the key from `Deno.env`; the literal is not in their source.
- `grep` for the new key across the mobile repos returns nothing.

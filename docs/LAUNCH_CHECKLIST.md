# XportACar — Launch-day checklist

Short, ordered, do-it-in-sequence. Tick each box. Items marked **[manual]**
must be done by a human (App Store Connect, key rotation, DNS); everything else
has a script or command.

> Repos: web `xportacar` (Vercel) · `xportacar-mobile` (buyer) ·
> `xportacar-inspection` (inspector). Supabase project:
> `klettmjnnttajdyajafn`.

---

## 0. Blockers — do these FIRST

- [x] **auto.dev API key rotated + moved server-side** (done 2026-06-09 — the
      mobile apps no longer carry the key; they call Edge Functions). Remaining
      **[manual]** steps: `supabase secrets set AUTODEV_API_KEY=<rotated>`,
      `supabase functions deploy valuation-proxy`,
      `supabase functions deploy vin-decoder-proxy`, and add `AUTODEV_API_KEY`
      to Vercel. See [`docs/SECURITY_autodev_key.md`](./SECURITY_autodev_key.md).
- [ ] **Take a database backup** (Supabase → Database → Backups) before any
      cleanup.
- [ ] **Set Resend up** (needed before the first real signup — see §5).

## 1. Production env vars (Vercel → Project → Settings → Environment Variables)

Required:
- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `NEXT_PUBLIC_SITE_URL` = `https://xportacar.com`

Email (before first signup):
- [ ] `RESEND_API_KEY`
- [ ] `RESEND_FROM` = e.g. `XportACar <noreply@xportacar.com>`

Optional / feature flags:
- [ ] `NEXT_PUBLIC_APP_DOWNLOAD_URL` — the real App Store/Play listing. **Leave
      unset until the apps are live** (the "Download App" banner self-hides when
      unset).
- [ ] `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`,
      `STRIPE_WEBHOOK_SECRET` — set to turn payments ON, or leave unset to keep
      the "Payment processing coming soon" state (a deliberate, disabled button,
      not a bug).
- [ ] `AUTODEV_API_KEY` (and/or `VALUATION_API_KEY`) — the **rotated** auto.dev
      key, server-side only (never `NEXT_PUBLIC_`). Also set as a Supabase
      Function secret for the proxies.

## 2. Pre-flight smoke test

- [ ] Run the smoke test against production (green checks):
      ```bash
      SUPABASE_SERVICE_ROLE_KEY=sb_secret_... python scripts/smoke_test.py
      ```
      Verifies tables/columns, buckets, marketplace, and that anon can read but
      not write.

## 3. Wipe demo data

- [ ] Run the cleanup SQL: Supabase → SQL Editor → paste
      [`supabase/cleanup_demo_data.sql`](../supabase/cleanup_demo_data.sql) →
      Run. Check the Notices tab for the deletion summary. (Idempotent; safe to
      re-run.)
- [ ] **Wipe demo Storage files** (SQL can't touch Storage):
  - `payment-proofs` bucket — delete everything (all demo proofs).
  - `vehicle-photos` bucket — delete demo `photos/…`, `documents/…`,
    `invoices/…/payment_proof/…`. **Keep the `_internal/` prefix** (platform
    settings JSON).
  - Dashboard: Storage → bucket → select folders → Delete. Scripted recipe:
    ```bash
    node -e "const{createClient}=require('@supabase/supabase-js');const s=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY);(async()=>{const b='payment-proofs';const{data}=await s.storage.from(b).list('',{limit:1000});for(const f of data||[]){const{data:inner}=await s.storage.from(b).list(f.name,{limit:1000});await s.storage.from(b).remove((inner||[]).map(x=>`${f.name}/${x.name}`));}console.log('payment-proofs cleared');})()"
    ```
- [ ] Re-run `smoke_test.py` — the marketplace check now reporting **0 live
      vehicles** is expected post-cleanup.

## 4. Domains & SSL

- [ ] `xportacar.com`, `xportacar.app`, `xportacar.de`, `xportacar.net` all
      resolve and load.
- [ ] Vercel SSL certificates **issued** for every domain (Vercel → Domains).
- [ ] Supabase → Authentication → URL Configuration: **Site URL** and
      **Redirect URLs** point at `https://xportacar.com` (so confirmation
      emails link to production, not localhost).

## 5. Email (Resend)

- [ ] Domain verified in Resend (SPF/DKIM DNS records added).
- [ ] `RESEND_API_KEY` + `RESEND_FROM` set on Vercel (§1).
- [ ] Send yourself a test signup → confirm the welcome email arrives and links
      to production.

## 6. Mobile apps

- [ ] **[manual] Buyer app:** once Apple approves, switch from "Manually
      release this version" to **Release** in App Store Connect.
- [ ] **[manual] Inspector app:** flagged 3.2 — keep on TestFlight; do not
      release publicly yet.
- [ ] Note: the error-boundary, role-gate, console-cleanup and double-submit
      fixes are JS-only (OTA-compatible) but are **not** in the current
      TestFlight builds — they land in the next `eas build` or OTA push. See
      each repo's `docs/OTA_UPDATES.md`. Do not push OTA during launch unless
      needed.

## 7. Production smoke test (manual, in the browser)

- [ ] Sign up a fresh account → welcome email received.
- [ ] Log in; place a bid on a live auction (after you've re-listed real stock).
- [ ] Admin: approve a KYC submission → approval email received.

## 8. Go live & monitor

- [ ] Flip DNS / mark the apps released.
- [ ] Watch **Vercel logs** and **Supabase logs** for the first hour.
- [ ] **[recommended]** Wire a crash reporter (Sentry) — there is currently
      **none** in any of the three apps, so production crashes are invisible
      even though error boundaries now show a fallback. See the error boundary
      files (`global-error.tsx`, RN `ErrorBoundary.tsx`) for the hook points.

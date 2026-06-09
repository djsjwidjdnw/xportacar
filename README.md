# XportACar

UAE-to-EU online car auction platform. UAE field teams inspect privately
owned vehicles, list them in timed online auctions, and European companies
bid on and purchase them.

**Web stack:** Next.js 16 (App Router) · TypeScript · Tailwind v4 · shadcn/ui
(base-nova) · Supabase (Postgres + Auth + Realtime + Storage) · recharts ·
next-intl-style i18n (EN / DE / AR / FR with RTL).
**Mobile stack:** Expo (React Native) · TypeScript · React Navigation ·
Supabase JS · expo-image · expo-camera / expo-image-picker · expo-notifications.

This repository covers the **web platform**.  The two mobile companions live
in sister repos: [`xportacar-mobile`](https://github.com/djsjwidjdnw/xportacar-mobile)
(buyer) and [`xportacar-inspection`](https://github.com/djsjwidjdnw/xportacar-inspection)
(field inspector).

## Phase 1 — what's shipped

| Step | What | Where |
|------|------|-------|
| 1 | Project scaffold (Next 16, shadcn, folder structure) | repo root |
| 2 | DB migration (8 tables, enums, RLS, realtime) | `supabase/migrations/001_initial_schema.sql` |
| 2b | Seed data (12 cars, 3 demo users, 12 auctions, ~35 bids) | `supabase/seed.sql` |
| 3 | Root + buyer + admin + auth layouts, language switcher | `src/app/layout.tsx` + `src/app/(buyer|admin|auth)/layout.tsx` |
| 4 | Landing page (hero, stats, features, how-it-works, CTA, footer) | `src/app/(buyer)/page.tsx` |
| 5 | Marketplace (search + 6 filters + sort + responsive grid, real Supabase data) | `src/app/(buyer)/marketplace/page.tsx` |
| 6 | Vehicle detail (gallery, specs, condition report, features, shipping estimator) | `src/app/(buyer)/vehicle/[id]/page.tsx` |
| 7 | Auction (sticky bid panel, countdown, bid history, **Realtime**, proxy bidding, counter offers) | `src/app/(buyer)/auction/[id]/page.tsx`, `src/hooks/useAuction.ts` |
| 8 | Buyer dashboard (active bids, won, total spent, invoices, saved searches, notifications) | `src/app/(buyer)/dashboard/page.tsx` |
| 9 | Admin dashboard (stats, recharts analytics, Kanban pipeline, status dropdown, inspector assignment, dark sidebar) | `src/app/(admin)/admin/dashboard/page.tsx` |
| 10 | i18n in EN / DE / AR / FR + Arabic RTL | `src/i18n/*.json`, `src/i18n/provider.tsx` |
| 11 | Login / register / sign-out + protected routes via `proxy.ts` | `src/app/(auth)/*`, `src/proxy.ts` |

## Phase 2 — feature drop (May 19 2026)

| Module | What | Where |
|--------|------|-------|
| **PWA** | Web app installable as a PWA (manifest, icons, service worker, offline shell) | `public/manifest.json`, `public/sw.js`, `public/icons/*` |
| **Proxy bidding** | "Set maximum bid" auto-outbids competitors up to user's max in €500 steps | `src/components/auction/BidPanel.tsx`, `placeBidAction` |
| **Counter offers** | Buyers send private offers, admins accept/reject | `src/app/(admin)/admin/counter-offers/`, `placeCounterOfferAction` |
| **Inspector assignment** | Kanban dropdown to assign `profiles.role=inspector` to scheduled vehicles | `src/components/admin/InspectorAssignSelect.tsx` |
| **Analytics** | Auctions/wk bar, revenue/month line, vehicles by status donut — all live data | `src/components/admin/AnalyticsCharts.tsx` |
| **Invoices** | Auto-generated on auction close, /admin/invoices list + printable detail | `src/app/(admin)/admin/invoices/`, DB trigger |
| **Saved searches** | "Save this search" on marketplace, listed on buyer dashboard | `src/components/marketplace/SaveSearchButton.tsx` |
| **Email** | Resend integration (welcome / outbid / won) — skips silently if no API key | `src/lib/email.ts` |
| **Shipping estimator** | 4-port quote table (Hamburg / Rotterdam / Genoa / Barcelona) | `src/components/vehicle/ShippingEstimator.tsx` |
| **Stripe Connect** | "Pay now" launches Stripe Checkout for invoice total (auction price + 5 % fee). Webhook marks invoice paid. Shows "coming soon" if keys unset. | `src/lib/stripe.ts`, `src/app/api/stripe/webhook/route.ts` |
| **KYC flow** | Buyers upload trade licence / ID via profile page; admins review at /admin/kyc | `src/components/profile/KycUploader.tsx`, `src/app/(admin)/admin/kyc/` |
| **Push tokens** | `/api/push-tokens` accepts Expo push tokens from mobile apps; `sendPushToUser` fans out via Expo Push API alongside in-app notifications | `src/app/api/push-tokens/route.ts`, `src/lib/push.ts` |
| **Notifications bell** | Bell icon in buyer nav with realtime unread count, mark-as-read | `src/components/layout/NotificationBell.tsx` |

## Database (Phase 2 additions)

`supabase/migrations/002_phase2_features.sql` adds:

- `counter_offers` (with status enum)
- `invoices`     (auto-generated via trigger when `auctions.status='sold'`)
- `saved_searches`
- `shipping_quotes`
- `kyc_submissions`
- `push_tokens`
- `bids.is_proxy` + `bids.proxy_max_eur`

Apply with the Management API helper:

```bash
SUPABASE_PAT=sbp_... node scripts/apply-phase2.mjs
```

## Getting started

### 1. Set up Supabase
1. Create a new project at [supabase.com](https://supabase.com).
2. Project Settings → API → copy the URL and anon key.

### 2. Configure environment
```bash
cp .env.local.example .env.local
# Required:
#   NEXT_PUBLIC_SUPABASE_URL
#   NEXT_PUBLIC_SUPABASE_ANON_KEY
#   SUPABASE_SERVICE_ROLE_KEY
#   NEXT_PUBLIC_SITE_URL
# Optional (silently skipped if unset):
#   RESEND_API_KEY, RESEND_FROM
#   STRIPE_SECRET_KEY, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY, STRIPE_WEBHOOK_SECRET
#   SUPABASE_PAT (only needed to apply schema via the API)
```

### 3. Apply schema and seed
Easiest path is the Supabase dashboard:
1. **SQL Editor** → paste `supabase/migrations/001_initial_schema.sql` → Run.
2. **SQL Editor** → paste `supabase/migrations/002_phase2_features.sql` → Run.
3. **Authentication** → Users → invite (or create with password) the three demo accounts:
   - `admin@xportacar.com`     (`Demo!1234`)
   - `buyer@xportacar.com`     (`Demo!1234`)
   - `inspector@xportacar.com` (`Demo!1234`)
   - *(optional extra bidders)* `buyer2@xportacar.com`, `buyer3@xportacar.com`
4. **SQL Editor** → paste `supabase/seed.sql` → Run.

If you have a Supabase PAT (`sbp_...`), one-liners:

```bash
SUPABASE_PAT=sbp_... SUPABASE_SERVICE_ROLE=... node scripts/apply-supabase.mjs
SUPABASE_PAT=sbp_... node scripts/apply-phase2.mjs
```

### 4. Run dev server
```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 5. Operational scripts
```bash
# Refresh demo: re-curate photos, re-stagger auctions to NOW+2h .. NOW+96h
SUPABASE_SERVICE_ROLE_KEY=... node scripts/fix-photos-and-auctions.mjs

# Regenerate PWA icons
node scripts/gen-icons.mjs
```

## Routes

| URL | Purpose | Auth |
|-----|---------|------|
| `/` | Landing | public |
| `/marketplace` | Vehicle grid + filters + saved-search | public |
| `/auctions` | Live auctions only | public |
| `/vehicle/[id]` | Vehicle detail + shipping estimator | public |
| `/auction/[id]` | Bid panel · proxy bidding · counter offers · Realtime | public to view, login to bid |
| `/auction/[id]/won` | Post-auction confirmation + Pay Now | winner |
| `/login`, `/register` | Supabase email auth | public |
| `/dashboard`, `/watchlist`, `/profile` | Buyer-private (incl. KYC upload, invoices, saved searches) | authenticated |
| `/admin/dashboard` | Operations dashboard with charts | admin |
| `/admin/vehicles`, `/admin/vehicles/[id]` | Inventory management | admin |
| `/admin/counter-offers` | Review buyer offers | admin |
| `/admin/invoices`, `/admin/invoices/[id]` | Invoicing, printable detail | admin |
| `/admin/kyc` | Verify trade-licence submissions | admin |
| `/api/auth/sign-out`, `/api/push-tokens`, `/api/stripe/webhook` | Endpoints | varies |

## Architecture notes

- **PWA**: `/manifest.json` + `/sw.js` (network-first navigations,
  stale-while-revalidate for static assets, runtime cache,
  Supabase/API requests passed through).  Registration via
  `<ServiceWorkerRegistrar />` in production builds only.
- **i18n**: locale stored in cookie `xpc_locale`, resolved server-side in
  `src/i18n/server.ts` (cookie → `Accept-Language` → default). Client
  components use `useTranslations(namespace)`. RTL auto-applied for Arabic.
- **Auth gating**: `src/proxy.ts` (Next 16's renamed middleware) refreshes
  Supabase cookies and redirects unauth/non-admin users.
- **Realtime**: `useAuction` subscribes to inserts on `bids` and updates
  on `auctions`, enriching each new bid with the bidder profile.
  `NotificationBell` subscribes to `notifications` for the signed-in user.
- **Proxy bidding cascade**: `placeBidAction` records `is_proxy=true` +
  `proxy_max_eur` on the user's bid.  After every new bid, `cascadeProxies`
  walks the active proxy ceilings on the auction and submits auto-bids
  (using the admin client) in €500 steps until either the top bidder
  exceeds all rival ceilings or the loop hits its hard stop.
- **Invoices**: auto-created by the `trg_auctions_invoice` AFTER UPDATE
  trigger when `auctions.status` flips to `sold`.  Platform fee 5 %,
  invoice number `XPC-YYYY-NNNNNN` from a sequence.
- **Email / Stripe**: both fall back to no-op when env vars are missing,
  so the app is usable in environments without paid services.
- **Push notifications**: `lib/push.ts` posts to Expo's push endpoint for
  every registered token belonging to the recipient.  Token registration
  is handled by the mobile apps via `/api/push-tokens`.

## Build

```bash
npm run build
```

## Deploy

Push to GitHub, import to Vercel, set the four required env vars (and any
optional ones you've configured) from `.env.local.example`, hit deploy.

In Supabase, add your Vercel URL to **Authentication → URL configuration →
Site URL / Redirect URLs** so signup confirmation emails point at production.

## Operations & launch

### Environment variables (where keys live)
All secrets live in environment variables — **never** in source. Locally they
go in `.env.local` (gitignored; the whole `.env*` glob is ignored, so there's no
tracked example file — use the list below). In production they're set in
**Vercel → Project → Settings → Environment Variables**.

| Var | Required | Purpose |
|-----|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase project URL (public) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Supabase publishable/anon key (public) |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Server-only admin key (RLS bypass) — never sent to the client |
| `NEXT_PUBLIC_SITE_URL` | yes | Canonical site URL, e.g. `https://xportacar.com` |
| `RESEND_API_KEY` | for email | Resend API key (see below) |
| `RESEND_FROM` | for email | From address, e.g. `XportACar <noreply@xportacar.com>` |
| `NEXT_PUBLIC_APP_DOWNLOAD_URL` | optional | Real App Store/Play URL; the "Download App" banner self-hides while unset |
| `STRIPE_SECRET_KEY` / `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` / `STRIPE_WEBHOOK_SECRET` | optional | Enables Stripe payments; unset = "Payment coming soon" |
| `VALUATION_API_KEY` | optional | Server-side auto.dev key for valuation (see security note) |
| `SUPABASE_PAT` | optional | Personal access token to apply schema via the API |

### Email (Resend)
Transactional email lives in `src/lib/email/` (`client.ts` = Resend transport,
`templates/` = one builder per email, `index.ts` = the `send*` helpers). It
**no-ops silently** when `RESEND_API_KEY` is unset (logging once in dev) and
never throws, so dev/preview work without a key. Wired flows today: welcome on
signup (`(auth)/actions.ts`), outbid/won (`(buyer)/auction/actions.ts`), KYC
approve/reject (`(admin)/admin/actions.ts`). Ready-but-unwired templates:
payment received (admin), payment verified (buyer), vehicle listed (seller).

To turn it on:
1. Create a [Resend](https://resend.com) account; verify your sending domain
   (add the SPF/DKIM DNS records it gives you).
2. Create an API key → set `RESEND_API_KEY` (and `RESEND_FROM`) in Vercel.
3. Redeploy. Send a test signup and confirm the welcome email arrives.

### Database / migrations
Migration history and how to apply: [`docs/MIGRATIONS.md`](docs/MIGRATIONS.md)
(001–012; the last three were the `vehicle-photos` bucket, `market_spec`, and
the admin audit log).

### Going to production
- **Launch checklist:** [`docs/LAUNCH_CHECKLIST.md`](docs/LAUNCH_CHECKLIST.md)
- **Demo-data wipe (pre-launch):** [`supabase/cleanup_demo_data.sql`](supabase/cleanup_demo_data.sql)
- **Pre-launch sanity check:** `python scripts/smoke_test.py`
- **Security follow-up (must do):** [`docs/SECURITY_autodev_key.md`](docs/SECURITY_autodev_key.md)

### Links
- Web: production on **Vercel** (custom domains: xportacar.com / .app / .de / .net)
- Supabase: project `klettmjnnttajdyajafn` ([dashboard](https://supabase.com/dashboard/project/klettmjnnttajdyajafn))
- App Store Connect: buyer + inspector apps ([appstoreconnect.apple.com](https://appstoreconnect.apple.com))
- Mobile repos: [`xportacar-mobile`](https://github.com/djsjwidjdnw/xportacar-mobile) (buyer) · [`xportacar-inspection`](https://github.com/djsjwidjdnw/xportacar-inspection) (inspector)

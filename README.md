# XportACar

UAE-to-EU online car auction platform. UAE field teams inspect privately
owned vehicles, list them in timed online auctions, and European companies
bid on and purchase them.

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind v4 · shadcn/ui
(base-nova) · Supabase (Postgres + Auth + Realtime) · next-intl-style i18n
(EN / DE / AR / FR with RTL).

## Phase 1 — what's shipped

| Step | What | Where |
|------|------|-------|
| 1 | Project scaffold (Next 16, shadcn, folder structure) | repo root |
| 2 | DB migration (8 tables, enums, RLS, realtime) | `supabase/migrations/001_initial_schema.sql` |
| 2b | Seed data (12 cars, 3 demo users, 12 auctions, ~35 bids) | `supabase/seed.sql` |
| 3 | Root + buyer + admin + auth layouts, language switcher | `src/app/layout.tsx` + `src/app/(buyer|admin|auth)/layout.tsx` |
| 4 | Landing page (hero, stats, features, how-it-works, CTA, footer) | `src/app/(buyer)/page.tsx` |
| 5 | Marketplace (search + 6 filters + sort + responsive grid, real Supabase data) | `src/app/(buyer)/marketplace/page.tsx` |
| 6 | Vehicle detail (gallery, specs, condition report, features) | `src/app/(buyer)/vehicle/[id]/page.tsx` |
| 7 | Auction (sticky bid panel, countdown, bid history, **Realtime**) | `src/app/(buyer)/auction/[id]/page.tsx`, `src/hooks/useAuction.ts` |
| 8 | Admin dashboard (stats, Kanban pipeline, activity table, dark sidebar) | `src/app/(admin)/admin/dashboard/page.tsx` |
| 9 | i18n in EN / DE / AR / FR + Arabic RTL | `src/i18n/*.json`, `src/i18n/provider.tsx` |
| 10 | Login / register / sign-out + protected routes via `proxy.ts` | `src/app/(auth)/*`, `src/proxy.ts` |

## Getting started

### 1. Set up Supabase
1. Create a new project at [supabase.com](https://supabase.com).
2. Project Settings → API → copy the URL and anon key.

### 2. Configure environment
```bash
cp .env.local.example .env.local
# fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
#         SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SITE_URL
```

### 3. Apply schema and seed
Easiest path is the Supabase dashboard:
1. **SQL Editor** → paste `supabase/migrations/001_initial_schema.sql` → Run.
2. **Authentication** → Users → invite (or create with password) the three demo accounts:
   - `admin@xportacar.com`     (`Demo!1234`)
   - `buyer@xportacar.com`     (`Demo!1234`)
   - `inspector@xportacar.com` (`Demo!1234`)
   - *(optional extra bidders)* `buyer2@xportacar.com`, `buyer3@xportacar.com`
3. **SQL Editor** → paste `supabase/seed.sql` → Run.
   The seed updates the auto-created profiles and inserts vehicles, auctions and bids.

If you have the [Supabase CLI](https://supabase.com/docs/guides/cli) linked locally:
```bash
supabase db push
# create the demo users via dashboard or `supabase functions invoke`
supabase db seed
```

### 4. Run dev server
```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Routes

| URL | Purpose | Auth |
|-----|---------|------|
| `/` | Landing | public |
| `/marketplace` | Vehicle grid + filters | public |
| `/auctions` | Live auctions only | public |
| `/vehicle/[id]` | Vehicle detail page | public |
| `/auction/[id]` | Auction page (Realtime bid panel) | public to view, login to bid |
| `/login`, `/register` | Supabase email auth | public |
| `/dashboard`, `/watchlist`, `/profile` | Buyer-private | authenticated |
| `/admin/dashboard` | Operations dashboard | role = `admin` or `superadmin` |
| `/api/auth/sign-out` | Sign-out endpoint | any |

## Architecture notes

- **i18n**: lightweight, locale stored in cookie `xpc_locale`, resolved server-side in
  `src/i18n/server.ts` (cookie → `Accept-Language` → default). Client components
  use `useTranslations(namespace)`. RTL is auto-applied for Arabic via `dir`.
- **Auth gating**: handled in `src/proxy.ts` (Next.js 16's renamed Middleware) which
  refreshes Supabase cookies and redirects unauthenticated/non-admin users.
- **Realtime**: `useAuction` subscribes to inserts on `bids` and updates on `auctions`
  for the current auction id, then enriches each new row with the bidder profile.
- **Supabase clients**: `createClient()` in `lib/supabase/client.ts` (browser) and
  `lib/supabase/server.ts` (server). The hand-written types in `lib/supabase/types.ts`
  are exported for query result casts; replace with
  `supabase gen types typescript --local > src/lib/supabase/types.ts` once you've
  linked the project.

## Build

```bash
npm run build
```

## Deploy

Push to GitHub, import to Vercel, set the four env vars from `.env.local.example`,
hit deploy.

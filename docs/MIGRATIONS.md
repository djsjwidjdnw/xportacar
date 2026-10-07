# Supabase migration history

Migrations live in `supabase/migrations/` and are applied in filename order.
Every migration is written to be **idempotent** (guards / `if not exists` /
`on conflict`), so re-running the full set is safe. The production project is
`klettmjnnttajdyajafn`.

`supabase/migrations/_APPLY_ALL_COMBINED.sql` concatenates them for a one-paste
apply in the SQL editor.

| # | File | What it does |
|---|------|--------------|
| 001 | `001_initial_schema.sql` | Core schema: enums (`user_role`, `vehicle_status`, `auction_status`, `photo_category`, …), tables `profiles`, `vehicles`, `vehicle_photos`, `vehicle_damages`, `auctions`, `bids`, `watchlist`, `notifications`; `handle_new_user` + `is_admin`/`is_staff` helpers; bid→auction counter trigger; RLS on every table; realtime on `bids`/`auctions`/`notifications`. |
| 002 | `002_phase2_features.sql` | Phase-2 tables: `counter_offers`, `invoices` (+ invoice-number sequence/trigger + auto-create-on-sold trigger, 5% fee), `saved_searches`, `shipping_quotes`, `kyc_submissions`, `push_tokens`; adds `bids.is_proxy` / `bids.proxy_max_eur`; RLS for all. |
| 003 | `003_platform_settings.sql` | `platform_settings` single-row config (fees, bid increments, inspector round-robin cursor). |
| 003 | `003_scale_indexes_rls.sql` | Extra indexes + RLS hardening for scale. (Two 003 files — both applied.) |
| 004 | `004_vehicle_valuations.sql` | `vehicle_valuations` cache table (server-side valuation caching, 7-day TTL). |
| 005 | `005_listing_workflow.sql` | Listing review workflow: `pending_review` / `changes_requested` statuses, `review_notes`, inspector-index cursor column. |
| 006 | `006_paint_thickness_enum.sql` | Adds `paint_thickness` value to the `photo_category` enum (inspector paint-gauge readings). |
| 007 | `007_production_updates.sql` | Production data/constraint touch-ups. |
| 008 | `008_payment_proof.sql` | Adds `invoices.payment_proof_urls` / `payment_proof_note` / `payment_verified_at`; `submit_payment_proof()` RPC (buyer uploads proof + notifies admins). |
| 009 | `009_payment_proofs_bucket.sql` | Creates the **private** `payment-proofs` Storage bucket (10 MB, PDF/PNG/JPEG) + per-invoice RLS (buyer owns their folder, admins read all). |
| 010 | `010_vehicle_photos_bucket.sql` | Creates the **public** `vehicle-photos` bucket (25 MB) explicitly + RLS so the inspector app (authenticated client) can upload. Fixes "Bucket not found" on inspection photo upload. |
| 011 | `011_market_spec.sql` | Adds `vehicles.market_spec` (e.g. "GCC Specs"), captured by the inspector app and shown on the specs grid. |
| 012 | `012_admin_audit_log.sql` | `admin_audit_log` table — records privileged admin edits (price/reserve/buy-now/end-time changes on live auctions, inspection re-opens). Staff-only RLS. |

## Recently applied (010–012)
These three were the last applied to production:

- **010** made the `vehicle-photos` bucket a real, policied bucket so inspector
  uploads work (previously created ad-hoc with no RLS).
- **011** added the `market_spec` free-text column for regional spec display.
- **012** introduced the admin audit log for live-listing edits and inspection
  re-opens.

## Applied 2026-10-07
- **031** `031_marketplace_mode.sql` — fixed-price marketplace: `app_settings.bidding_enabled` (false), `public.bidding_enabled()`, bids + counter_offers INSERT policies gated on it (`buy_now()` unaffected — SECURITY DEFINER, table owner), and re-applies the guarded `sync_vehicle_eur_from_aed()` that commit e57586f wrote into 015 but never applied. Creates no table. Rehearsed in a rolled-back transaction, applied, read back (cluster 7634664568297872568).

## Grants rule (from 30 Oct 2026)
New tables in `public` are no longer auto-granted to the Data API. Every migration
that creates a table carries its `grant` lines in the same file — start from
`supabase/MIGRATION_TEMPLATE.sql`. The full rule is in `CLAUDE.md`.

### Grants audit (2026-10-07, read-only — nothing changed)
Live privileges come from the project's default ACL (`postgres` and `supabase_admin`
default-grant ALL on new `public` tables to `anon`, `authenticated`, `service_role`).
None of the creating migrations grants table privileges, so **every table below would
return `permission denied` on a fresh database** (preview branch, `supabase db reset`)
once the old automatic grant is gone:

| Migration | Tables relying on the automatic grant |
|---|---|
| 001 | profiles, vehicles, vehicle_photos, vehicle_damages, auctions, bids, watchlist, notifications |
| 002 | counter_offers, invoices, saved_searches, shipping_quotes, kyc_submissions, push_tokens |
| 003_platform_settings | platform_settings |
| 004 | vehicle_valuations, shipping_rates |
| 012 | admin_audit_log |
| 013 | inspector_applications |
| 015 | paint_thickness_readings |
| 016 | vehicle_status_events, automated_email_log |
| 019 | vin_decode_cache, vincario_usage_log |
| 025 | prelaunch_signups, app_settings |
| 028 | vehicle_sellers |

27 of 27 live `public` tables. All have RLS enabled. Fixing them is a separate,
deliberate migration (not done in the 2026-10-07 run).

## Applying a new migration
Dashboard → SQL Editor → paste the file → Run. Or, with a Supabase PAT:
```bash
SUPABASE_PAT=sbp_... node scripts/apply-supabase.mjs   # see scripts/ for helpers
```
After a schema change, regenerate types:
```bash
supabase gen types typescript --project-id klettmjnnttajdyajafn > src/lib/supabase/types.ts
```

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

## Applying a new migration
Dashboard → SQL Editor → paste the file → Run. Or, with a Supabase PAT:
```bash
SUPABASE_PAT=sbp_... node scripts/apply-supabase.mjs   # see scripts/ for helpers
```
After a schema change, regenerate types:
```bash
supabase gen types typescript --project-id klettmjnnttajdyajafn > src/lib/supabase/types.ts
```

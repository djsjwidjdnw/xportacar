-- =====================================================================
-- 005_listing_workflow.sql
-- Inspection → listing review workflow.
--   * Two new vehicle_status values: pending_review, changes_requested
--   * vehicles.review_notes  — admin's "request changes" feedback
--   * platform_settings.last_inspector_index — round-robin auto-assign cursor
-- Idempotent + safe to re-run.
--
-- NOTE on the ALTER TYPE lines: Postgres 12+ allows ADD VALUE inside a
-- transaction as long as the new value isn't *used* in the same transaction.
-- This script only adds columns (it never inserts the new status), so it is
-- safe to run as one block. If your client wraps it in a transaction and
-- still complains, run the two ALTER TYPE lines on their own first.
-- =====================================================================

alter type vehicle_status add value if not exists 'pending_review';
alter type vehicle_status add value if not exists 'changes_requested';

-- Admin feedback when a vehicle is sent back to the inspector. Cleared on
-- approve / re-submit.
alter table public.vehicles
  add column if not exists review_notes text;

-- Round-robin cursor for "Auto-Assign": the index of the inspector who got
-- the last assignment, so the next one goes to the following inspector.
alter table public.platform_settings
  add column if not exists last_inspector_index int not null default 0;

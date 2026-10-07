-- =====================================================================
-- 2026-10-07 — Move CRON_SECRET out of cron.job into Supabase Vault.
--                                               *** APPLIED 2026-10-07 ***
--
-- Before: all three pg_cron jobs (close-expired-auctions */2, notify-watchlist-
-- matches */30, notify-auctions-ending-soon hourly) carried the secret as a
-- plain-text literal — jsonb_build_object('x-cron-secret','<value>') — so it
-- was readable in cron.job and in every cron.job_run_details row (93,191).
-- After: Vault secret `cron_secret` (encrypted at rest; must equal the
-- CRON_SECRET Edge Function secret); each job reads it at run time with
--   (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
-- and the run history is redacted (status and timings kept).
--
-- Applied 09:40:04 UTC on cluster 7634664568297872568 after a rolled-back
-- rehearsal. The value never left the database: it was read from cron.job,
-- stored with vault.create_secret() and compared by equality in SQL.
-- Verified: first run on the Vault command (09:42:00) succeeded and the Edge
-- Function answered HTTP 200 {"ok":true,...}; 0 jobs, 0 history rows, 0 queued
-- requests, 0 responses and 0 functions still contain the value.
--
-- Re-running this is safe: it refuses if `cron_secret` already exists.
-- To ROTATE the secret later: generate a new value, then
--   select vault.update_secret((select id from vault.secrets where name = 'cron_secret'), '<new>');
--   supabase secrets set CRON_SECRET=<new>
-- (CRON_SECRET also signs invoice PDF links and KYC upload tokens unless
-- SIGNED_URL_SECRET is set on Vercel — rotate that side together.)
-- =====================================================================
do $body$
declare
  v_lit text;
  v_n   int;
  v_ref constant text := '(select decrypted_secret from vault.decrypted_secrets where name = ''cron_secret'')';
begin
  select count(distinct substring(command from '''x-cron-secret''\s*,\s*''([^'']*)''')) into v_n
    from cron.job where command ~ '''x-cron-secret''\s*,\s*''';
  if v_n <> 1 then
    raise exception 'expected exactly one distinct plain-text cron secret, found %', v_n;
  end if;
  select substring(command from '''x-cron-secret''\s*,\s*''([^'']*)''') into v_lit
    from cron.job where command ~ '''x-cron-secret''\s*,\s*''' limit 1;
  if exists (select 1 from vault.secrets where name = 'cron_secret') then
    raise exception 'a vault secret named cron_secret already exists - not overwriting';
  end if;

  -- 1. The secret goes into Vault.
  perform vault.create_secret(v_lit, 'cron_secret',
    'x-cron-secret for the pg_cron -> Edge Function jobs (close-expired-auctions, notify-watchlist-matches, notify-auctions-ending-soon). Must equal the CRON_SECRET Edge Function secret. Moved out of cron.job on 2026-10-07.');

  -- 2. Every job reads it from Vault at run time.
  perform cron.alter_job(j.jobid,
           command := regexp_replace(j.command, '''x-cron-secret''\s*,\s*''[^'']*''', '''x-cron-secret'', ' || v_ref))
     from cron.job j
    where j.command ~ '''x-cron-secret''\s*,\s*''';

  -- 3. Redact the value from the run history.
  update cron.job_run_details
     set command = replace(command, v_lit, '<redacted: moved to vault secret cron_secret>')
   where position(v_lit in command) > 0;
end
$body$;

-- A run that had already started with the old command keeps the literal in its
-- history row; redact any such stragglers once it has finished:
with s as (select decrypted_secret as v from vault.decrypted_secrets where name = 'cron_secret')
update cron.job_run_details d
   set command = replace(d.command, s.v, '<redacted: moved to vault secret cron_secret>')
  from s
 where position(s.v in d.command) > 0;

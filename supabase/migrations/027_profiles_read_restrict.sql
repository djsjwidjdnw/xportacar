-- 027_profiles_read_restrict.sql
-- Stop the profiles table from being world-readable.
--
-- Background: the original policy "profiles are viewable by everyone"
-- USING (true) exposes EVERY user's email, phone, company_name,
-- company_registration, country, role and kyc_status to anon + any
-- authenticated user via PostgREST, and makes every account's role publicly
-- enumerable. This restricts SELECT to the row owner and to staff
-- (is_staff = admin | superadmin | inspector), which is what the app UIs need.
--
-- ⚠️ APPLY ORDER: deploy the web app first. Two server paths read OTHER users'
-- profiles with the anon/authenticated client and rely on the old permissive
-- policy; they were switched to the service-role client in the same batch as
-- this migration:
--   * src/components/landing/MarketingHome.tsx  (public buyer counts/countries)
--   * src/app/(buyer)/auction/actions.ts :: notifyOutbid  (outbid-email lookup)
-- After that deploy is live, this migration is safe. (Audited: the buyer mobile
-- app only reads its own profile; the inspector app's admin lookup works
-- because inspectors are is_staff; all other cross-user reads already use the
-- service-role/admin client or run from a staff session.)

drop policy if exists "profiles are viewable by everyone" on public.profiles;

create policy "profiles are viewable by self or staff"
  on public.profiles for select
  using (auth.uid() = id or public.is_staff(auth.uid()));

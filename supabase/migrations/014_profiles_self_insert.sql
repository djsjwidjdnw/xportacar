-- Allow a signed-in user to INSERT their own profile row.
--
-- Profiles are normally created by the handle_new_user trigger (security
-- definer, atomic with the auth.users insert). The mobile/web signup flows also
-- do a belt-and-braces client upsert; without an INSERT policy that upsert could
-- only ever UPDATE the trigger-created row and silently failed as a fallback if
-- the row was ever missing. This policy lets the client self-create its own row
-- (and nobody else's). Idempotent.

drop policy if exists "users can insert own profile" on public.profiles;
create policy "users can insert own profile"
  on public.profiles for insert to authenticated
  with check (auth.uid() = id);

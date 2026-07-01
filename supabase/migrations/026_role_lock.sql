-- 026_role_lock.sql
-- Prevent privilege self-escalation via the `profiles.role` column.
--
-- Background: profiles.role is the single source of truth for authorization
-- (is_admin / is_staff read it directly, and the apps gate on it). Two paths
-- currently let a client choose its own role:
--   1. SIGNUP  — handle_new_user() copies raw_user_meta_data->>'role' verbatim,
--                so a crafted signup could request role='admin'.
--   2. UPDATE  — the "users can update own profile" RLS policy has no column
--                restriction, so a signed-in buyer could PATCH profiles.role
--                to 'inspector'/'admin'/'superadmin' and defeat the app gates.
--
-- This migration closes both. Admin/superadmin remain assignable only by an
-- existing admin (through the app) or a privileged backend context
-- (service_role / direct SQL), never by self-service.
--
-- SAFE TO APPLY ANY TIME. No app changes are required — the buyer/inspector
-- signup flows already request only 'buyer'/'inspector', and role changes go
-- through admin/service-role paths.

-- 1) SIGNUP PATH — clamp the requested role. Self-registration may only ask for
--    'buyer' or 'inspector'; anything else (incl. admin/superadmin) becomes
--    'buyer'.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  requested text := new.raw_user_meta_data->>'role';
begin
  insert into public.profiles (id, email, full_name, company_name, country, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'company_name',
    new.raw_user_meta_data->>'country',
    case
      when requested in ('buyer', 'inspector') then requested::user_role
      else 'buyer'::user_role
    end
  )
  on conflict (id) do nothing;
  return new;
end $$;

-- 2) UPDATE PATH — block a signed-in non-admin from changing their own role.
--    auth.uid() is NULL for the service_role client and for direct SQL, so
--    those privileged contexts (and admins acting through the app) are allowed;
--    a normal authenticated buyer/inspector is not. Only fires on an actual
--    change (role IS DISTINCT FROM), so no-op updates (e.g. the signup upsert
--    re-writing the same 'buyer'/'inspector') pass through untouched.
create or replace function public.enforce_role_immutable()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role
     and auth.uid() is not null
     and not public.is_admin(auth.uid()) then
    raise exception 'Not allowed to change account role'
      using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists trg_profiles_role_lock on public.profiles;
create trigger trg_profiles_role_lock
  before update on public.profiles
  for each row execute function public.enforce_role_immutable();

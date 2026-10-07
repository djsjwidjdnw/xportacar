-- =====================================================================
-- 033 — Notifications insert hole.
--
-- The hole: policy "system inserts notifications" (INSERT, role public,
-- WITH CHECK true) let anyone — even anon — create a notification addressed
-- to anyone.
--
-- Writers (2026-10-07):
--   service role (RLS bypassed, unchanged): close-expired-auctions Edge
--     Function (cron), settleEndedAuctions (src/lib/auctions.ts), payment
--     proof (won/actions.ts), counter-offer admin actions, KYC submit
--     (profile/kyc-actions.ts); submit_payment_proof() is SECURITY DEFINER.
--   as the signed-in user:
--     - buyNowAction: notifies the buyer themself -> still allowed below;
--     - web admin actions (inspector assignment, scheduling, KYC decision,
--       changes requested) and notifyOutbid: addressed to OTHER users ->
--       moved to the service role in the same commit;
--     - inspector app DashboardScreen "submit for listing" (installed 1.0.0
--       and 1.0.1 builds): notifies the admins from the device -> blocked
--       now; the same notification is written by the trigger below instead,
--       so installed inspector apps keep notifying admins with no new build.
--
-- This migration:
--   1. replaces the open INSERT policy with "users insert own notifications"
--      (authenticated, user_id = auth.uid()); anon cannot insert at all;
--   2. adds trg_vehicles_notify_submitted: inspected -> pending_review
--      notifies every admin, with the title/body the inspector app used.
--
-- Creates no table (grants rule: nothing to grant). Idempotent.
-- =====================================================================

-- 1. Only the service role (crons, server) writes notifications for others.
drop policy if exists "system inserts notifications" on public.notifications;
drop policy if exists "users insert own notifications" on public.notifications;
create policy "users insert own notifications"
  on public.notifications for insert
  to authenticated
  with check (user_id = auth.uid());

-- 2. "Vehicle ready for listing" for the admins, written server-side.
create or replace function public.notify_admins_vehicle_submitted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    insert into public.notifications (user_id, type, title, body, data)
    select p.id,
           'status_update',
           'Vehicle ready for listing',
           concat_ws(' ', new.year, new.make, new.model) || ' was submitted for listing.',
           jsonb_build_object('vehicle_id', new.id)
      from public.profiles p
     where p.role in ('admin', 'superadmin');
  exception when others then
    null; -- best-effort, like the app code it replaces: never block the status change
  end;
  return null;
end
$$;

revoke all on function public.notify_admins_vehicle_submitted() from public, anon, authenticated, service_role;

drop trigger if exists trg_vehicles_notify_submitted on public.vehicles;
create trigger trg_vehicles_notify_submitted
  after update of status on public.vehicles
  for each row
  when (old.status = 'inspected' and new.status = 'pending_review')
  execute function public.notify_admins_vehicle_submitted();

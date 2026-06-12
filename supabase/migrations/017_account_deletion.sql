-- =====================================================================
-- 017 — Self-service account deletion (Apple Guideline 5.1.1(v)).
-- Authenticated users delete their own account + data. Financial records
-- (invoices) are LEGALLY RETAINED but anonymized. Idempotent.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Invoices must SURVIVE account deletion (anonymized), not cascade away.
-- As shipped, invoices.buyer_id is NOT NULL + ON DELETE CASCADE, so deleting
-- the profile/auth user would DELETE the invoice. Make it nullable, switch the
-- FK to ON DELETE SET NULL, and add a column to archive the buyer's email.
-- ---------------------------------------------------------------------
alter table public.invoices alter column buyer_id drop not null;
alter table public.invoices drop constraint if exists invoices_buyer_id_fkey;
alter table public.invoices
  add constraint invoices_buyer_id_fkey
  foreign key (buyer_id) references public.profiles(id) on delete set null;
alter table public.invoices
  add column if not exists archived_buyer_email text;

-- ---------------------------------------------------------------------
-- delete_my_account() — scrubs/deletes everything tied to the CALLER, keeps
-- anonymized invoices, logs the deletion, then deletes the profile row.
-- Cannot delete the auth.users row (no privilege) — the delete-my-account Edge
-- Function does that with the service role AFTER this returns. SECURITY DEFINER
-- so it can write across tables; auth.uid() still resolves to the caller.
-- Idempotent: every step is scoped by auth.uid(); a second call is a no-op once
-- the profile is gone (auth.uid() then has no rows to touch).
-- ---------------------------------------------------------------------
create or replace function public.delete_my_account()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid   uuid := auth.uid();
  v_email text;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'error', 'not authenticated');
  end if;

  select email into v_email from public.profiles where id = uid;

  -- Audit trail BEFORE scrubbing (actor_id SET NULLs itself when the profile
  -- goes, but the note keeps the email for compliance).
  begin
    insert into public.admin_audit_log (actor_id, entity_type, entity_id, action, note)
    values (uid, 'profile', uid, 'account_self_deleted',
            'Account self-deleted: ' || coalesce(v_email, '(unknown)'));
  exception when others then null; -- never block deletion on audit failure
  end;

  -- Anonymize invoices (legal retention) — archive the email, drop the link.
  update public.invoices
     set archived_buyer_email = coalesce(archived_buyer_email, v_email),
         buyer_id = null
   where buyer_id = uid;

  -- Explicit deletes of the user's personal data (counter_offers uses
  -- bidder_id, not buyer_id). vehicle_valuations has no user column (shared
  -- cache) so there is nothing per-user to remove there.
  delete from public.bids                 where bidder_id = uid;
  delete from public.watchlist            where user_id  = uid;
  delete from public.notifications        where user_id  = uid;
  delete from public.counter_offers       where bidder_id = uid;

  -- These tables exist only after later migrations — guard each so the function
  -- applies cleanly regardless of which optional migrations are present.
  if to_regclass('public.saved_searches')       is not null then delete from public.saved_searches       where user_id = uid; end if;
  if to_regclass('public.kyc_submissions')      is not null then delete from public.kyc_submissions      where user_id = uid; end if;
  if to_regclass('public.push_tokens')          is not null then delete from public.push_tokens          where user_id = uid; end if;
  if to_regclass('public.inspector_applications') is not null then delete from public.inspector_applications where user_id = uid; end if;
  if to_regclass('public.automated_email_log')  is not null then delete from public.automated_email_log  where user_id = uid; end if;
  -- shipping_quotes.buyer_id is ON DELETE SET NULL (a business quote record) —
  -- detach rather than delete.
  if to_regclass('public.shipping_quotes')      is not null then update public.shipping_quotes set buyer_id = null where buyer_id = uid; end if;

  -- Inspector business data (vehicles they inspected, photos, damages) stays
  -- attached to the vehicle; vehicles.inspector_id / created_by are ON DELETE
  -- SET NULL, so deleting the profile detaches the inspector automatically.

  -- Finally remove the profile. This CASCADE-cleans any remaining
  -- profile-referencing rows and SET NULLs invoices/vehicles/audit references.
  delete from public.profiles where id = uid;

  return jsonb_build_object('ok', true, 'email', v_email);
end;
$$;

-- Callable by signed-in users for THEIR OWN account only (the body is scoped to
-- auth.uid(); no argument lets a caller target anyone else).
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

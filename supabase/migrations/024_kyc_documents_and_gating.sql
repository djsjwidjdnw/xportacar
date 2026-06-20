-- =====================================================================
-- 024 — KYC documents bucket (PRIVATE) + RLS, KYC profile/audit columns,
--        and bid/Buy-Now gating on verified KYC.
--
-- Context: a KYC system already exists (kyc_status enum 'pending'/'verified'/
-- 'rejected', kyc_submissions table, admin review flow). This migration:
--   1. Creates the kyc-documents bucket as PRIVATE with owner/admin RLS
--      (it was previously created on-demand by app code as PUBLIC — sensitive
--      ID/trade-license docs must not be world-readable by URL).
--   2. Adds business-flag + rejection-reason + review-audit columns to profiles
--      and an id_subtype column to kyc_submissions (passport/licence/national id).
--   3. Gates bidding + Buy Now on kyc_status = 'verified'.
--
-- Idempotent: safe to re-run.  Apply in the Supabase SQL editor.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) PRIVATE kyc-documents bucket  (path convention: {user_id}/{file})
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('kyc-documents', 'kyc-documents', false, 10485760,
        array['application/pdf', 'image/png', 'image/jpeg'])
on conflict (id) do update set
  public             = false,
  file_size_limit    = 10485760,
  allowed_mime_types = array['application/pdf', 'image/png', 'image/jpeg'];

-- RLS on storage.objects (re-runnable). The first path segment is the owner's
-- user id, so a buyer can only ever touch their own {user_id}/ folder.
-- Uploads from the app go through the service-role key (bypasses RLS); these
-- policies cover any future direct-client access and admin reads.

drop policy if exists "kyc_documents_insert_owner" on storage.objects;
create policy "kyc_documents_insert_owner" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'kyc-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "kyc_documents_select_owner_or_admin" on storage.objects;
create policy "kyc_documents_select_owner_or_admin" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'kyc-documents'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.role in ('admin', 'superadmin')
      )
    )
  );

drop policy if exists "kyc_documents_update_owner_or_admin" on storage.objects;
create policy "kyc_documents_update_owner_or_admin" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'kyc-documents'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','superadmin'))
    )
  );

drop policy if exists "kyc_documents_delete_owner_or_admin" on storage.objects;
create policy "kyc_documents_delete_owner_or_admin" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'kyc-documents'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','superadmin'))
    )
  );

-- ---------------------------------------------------------------------
-- 2) profiles: business flag + rejection reason + review audit
-- ---------------------------------------------------------------------
alter table public.profiles add column if not exists kyc_is_business      boolean not null default false;
alter table public.profiles add column if not exists kyc_rejection_reason text;
alter table public.profiles add column if not exists kyc_submitted_at     timestamptz;
alter table public.profiles add column if not exists kyc_reviewed_at      timestamptz;
alter table public.profiles add column if not exists kyc_reviewed_by      uuid references public.profiles(id) on delete set null;

-- kyc_submissions: which kind of personal ID the id_document is.
alter table public.kyc_submissions add column if not exists id_subtype text;
do $$ begin
  alter table public.kyc_submissions
    add constraint kyc_submissions_id_subtype_chk
    check (id_subtype is null or id_subtype in ('passport', 'drivers_license', 'national_id'));
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- 3) Gating: bids + Buy Now require kyc_status = 'verified'
-- ---------------------------------------------------------------------

-- Helper mirrors is_admin/is_staff (SECURITY DEFINER so RLS on profiles can't
-- mask the answer). 'verified' is the approved state of the kyc_status enum
-- ('pending','verified','rejected') — there is no 'approved' on this enum.
create or replace function public.is_kyc_verified(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles where id = uid and kyc_status = 'verified'
  );
$$;

-- Direct-insert bid path (web user-scoped client + mobile). Replace the
-- auth-only policy with an auth + verified-KYC policy.
drop policy if exists "authenticated users can place bids" on public.bids;
drop policy if exists "verified users can place bids" on public.bids;
create policy "verified users can place bids"
  on public.bids for insert
  with check (auth.uid() = bidder_id and public.is_kyc_verified(auth.uid()));

-- Buy Now RPC (mobile path; SECURITY DEFINER bypasses RLS, so the gate must be
-- inside the function). Re-declares 023's body with a KYC guard added.
create or replace function public.buy_now(p_auction_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_auction public.auctions%rowtype;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  -- KYC gate: only verified buyers may Buy Now.
  if not public.is_kyc_verified(v_uid) then
    raise exception 'KYC_REQUIRED' using errcode = '42501';
  end if;

  -- Lock the auction row to serialize concurrent Buy Now / bids.
  select * into v_auction from public.auctions where id = p_auction_id for update;
  if not found then
    raise exception 'AUCTION_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_auction.status <> 'active' then
    raise exception 'AUCTION_NOT_ACTIVE' using errcode = 'P0001';
  end if;
  if v_auction.end_time <= now() then
    raise exception 'AUCTION_ENDED' using errcode = 'P0001';
  end if;
  if v_auction.buy_now_price_eur is null then
    raise exception 'BUY_NOW_UNAVAILABLE' using errcode = 'P0001';
  end if;

  -- Record the winning Buy-Now bid.
  insert into public.bids (auction_id, bidder_id, amount_eur)
  values (p_auction_id, v_uid, v_auction.buy_now_price_eur);

  -- Close the auction → trg_auctions_invoice auto-creates the invoice.
  update public.auctions
     set status          = 'sold',
         winner_id       = v_uid,
         end_time        = now(),
         current_bid_eur = v_auction.buy_now_price_eur
   where id = p_auction_id;

  -- Mark the vehicle sold (mirrors the web server action).
  update public.vehicles
     set status = 'sold', sold_at = now()
   where id = v_auction.vehicle_id;

  return p_auction_id;
end;
$$;

revoke all on function public.buy_now(uuid) from public;
grant execute on function public.buy_now(uuid) to authenticated;

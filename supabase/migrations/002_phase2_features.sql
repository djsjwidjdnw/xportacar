-- =====================================================================
-- XportACar — Phase 2 schema additions
-- counter offers, invoices, saved searches, shipping quotes, KYC, push
-- tokens, and proxy-max column on bids.  Idempotent: safe to re-run.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Enums (created only if missing)
-- ---------------------------------------------------------------------
do $$ begin
  create type counter_offer_status as enum ('pending', 'accepted', 'rejected', 'expired');
exception when duplicate_object then null; end $$;

do $$ begin
  create type invoice_status as enum ('pending', 'paid', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type kyc_doc_type as enum ('trade_license', 'id_document', 'utility_bill', 'other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type kyc_review_status as enum ('pending', 'approved', 'rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type device_platform as enum ('ios', 'android', 'web');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- counter_offers
-- ---------------------------------------------------------------------
create table if not exists public.counter_offers (
  id            uuid primary key default uuid_generate_v4(),
  auction_id    uuid not null references public.auctions(id) on delete cascade,
  bidder_id     uuid not null references public.profiles(id) on delete cascade,
  amount_eur    numeric(12,2) not null,
  status        counter_offer_status not null default 'pending',
  message       text,
  reviewed_by   uuid references public.profiles(id) on delete set null,
  reviewed_at   timestamptz,
  expires_at    timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists idx_counter_offers_auction on public.counter_offers(auction_id, status);
create index if not exists idx_counter_offers_bidder  on public.counter_offers(bidder_id, created_at desc);

-- ---------------------------------------------------------------------
-- invoices
-- ---------------------------------------------------------------------
create table if not exists public.invoices (
  id                 uuid primary key default uuid_generate_v4(),
  auction_id         uuid not null unique references public.auctions(id) on delete cascade,
  buyer_id           uuid not null references public.profiles(id) on delete cascade,
  vehicle_id         uuid not null references public.vehicles(id) on delete cascade,
  amount_eur         numeric(12,2) not null,
  platform_fee_eur   numeric(12,2) not null default 0,
  total_eur          numeric(12,2) not null,
  status             invoice_status not null default 'pending',
  invoice_number     text unique,
  stripe_session_id  text,
  paid_at            timestamptz,
  created_at         timestamptz not null default now()
);
create index if not exists idx_invoices_buyer  on public.invoices(buyer_id, created_at desc);
create index if not exists idx_invoices_status on public.invoices(status);

-- Sequence + trigger for invoice number "XPC-YYYY-000123".
create sequence if not exists invoice_number_seq;
create or replace function public.set_invoice_number()
returns trigger language plpgsql as $$
begin
  if new.invoice_number is null then
    new.invoice_number := 'XPC-' || to_char(now(), 'YYYY') || '-' ||
      lpad(nextval('invoice_number_seq')::text, 6, '0');
  end if;
  return new;
end $$;
drop trigger if exists trg_invoice_number on public.invoices;
create trigger trg_invoice_number
  before insert on public.invoices
  for each row execute function public.set_invoice_number();

-- ---------------------------------------------------------------------
-- Auto-create invoice when an auction is marked sold.
-- 5 % platform fee.
-- ---------------------------------------------------------------------
create or replace function public.create_invoice_for_sold_auction()
returns trigger language plpgsql as $$
declare
  v_amount   numeric(12,2);
  v_fee      numeric(12,2);
begin
  if new.status = 'sold' and (old.status is distinct from 'sold') and new.winner_id is not null then
    v_amount := coalesce(new.current_bid_eur, new.starting_price_eur);
    v_fee    := round(v_amount * 0.05, 2);
    insert into public.invoices (auction_id, buyer_id, vehicle_id, amount_eur, platform_fee_eur, total_eur, status)
    values (new.id, new.winner_id, new.vehicle_id, v_amount, v_fee, v_amount + v_fee, 'pending')
    on conflict (auction_id) do nothing;
  end if;
  return new;
end $$;
drop trigger if exists trg_auctions_invoice on public.auctions;
create trigger trg_auctions_invoice
  after update on public.auctions
  for each row execute function public.create_invoice_for_sold_auction();

-- ---------------------------------------------------------------------
-- saved_searches
-- ---------------------------------------------------------------------
create table if not exists public.saved_searches (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  name       text not null,
  filters    jsonb not null default '{}',
  notify     boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_saved_searches_user on public.saved_searches(user_id, created_at desc);

-- ---------------------------------------------------------------------
-- shipping_quotes
-- ---------------------------------------------------------------------
create table if not exists public.shipping_quotes (
  id              uuid primary key default uuid_generate_v4(),
  vehicle_id      uuid not null references public.vehicles(id) on delete cascade,
  buyer_id        uuid references public.profiles(id) on delete set null,
  destination     text not null,
  cost_eur        numeric(12,2) not null,
  transit_days    int not null,
  carrier         text,
  created_at      timestamptz not null default now()
);
create index if not exists idx_shipping_quotes_vehicle on public.shipping_quotes(vehicle_id);

-- ---------------------------------------------------------------------
-- kyc_submissions
-- ---------------------------------------------------------------------
create table if not exists public.kyc_submissions (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  document_type kyc_doc_type not null,
  file_url      text not null,
  status        kyc_review_status not null default 'pending',
  reviewed_by   uuid references public.profiles(id) on delete set null,
  reviewer_note text,
  reviewed_at   timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists idx_kyc_user on public.kyc_submissions(user_id, created_at desc);
create index if not exists idx_kyc_status on public.kyc_submissions(status);

-- ---------------------------------------------------------------------
-- push_tokens
-- ---------------------------------------------------------------------
create table if not exists public.push_tokens (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  token       text not null,
  platform    device_platform not null,
  device_name text,
  last_seen   timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  unique (user_id, token)
);
create index if not exists idx_push_tokens_user on public.push_tokens(user_id);

-- ---------------------------------------------------------------------
-- Proxy max on existing bids
-- ---------------------------------------------------------------------
alter table public.bids
  add column if not exists is_proxy boolean not null default false,
  add column if not exists proxy_max_eur numeric(12,2);

-- =====================================================================
-- Realtime publication
-- =====================================================================
do $$ begin
  begin alter publication supabase_realtime add table public.counter_offers; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.invoices;       exception when duplicate_object then null; end;
end $$;

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================
alter table public.counter_offers   enable row level security;
alter table public.invoices         enable row level security;
alter table public.saved_searches   enable row level security;
alter table public.shipping_quotes  enable row level security;
alter table public.kyc_submissions  enable row level security;
alter table public.push_tokens      enable row level security;

-- counter_offers -------------------------------------------------------
drop policy if exists "bidders see their counter offers" on public.counter_offers;
create policy "bidders see their counter offers"
  on public.counter_offers for select
  using (auth.uid() = bidder_id or public.is_staff(auth.uid()));

drop policy if exists "bidders insert their counter offers" on public.counter_offers;
create policy "bidders insert their counter offers"
  on public.counter_offers for insert
  with check (auth.uid() = bidder_id);

drop policy if exists "staff update counter offers" on public.counter_offers;
create policy "staff update counter offers"
  on public.counter_offers for update
  using (public.is_staff(auth.uid()));

-- invoices -------------------------------------------------------------
drop policy if exists "buyers see own invoices" on public.invoices;
create policy "buyers see own invoices"
  on public.invoices for select
  using (auth.uid() = buyer_id or public.is_staff(auth.uid()));

drop policy if exists "staff update invoices" on public.invoices;
create policy "staff update invoices"
  on public.invoices for update
  using (public.is_staff(auth.uid()));

drop policy if exists "buyers update own invoices" on public.invoices;
create policy "buyers update own invoices"
  on public.invoices for update
  using (auth.uid() = buyer_id);

-- saved_searches -------------------------------------------------------
drop policy if exists "users see own saved searches" on public.saved_searches;
create policy "users see own saved searches"
  on public.saved_searches for select using (auth.uid() = user_id);

drop policy if exists "users insert own saved searches" on public.saved_searches;
create policy "users insert own saved searches"
  on public.saved_searches for insert with check (auth.uid() = user_id);

drop policy if exists "users delete own saved searches" on public.saved_searches;
create policy "users delete own saved searches"
  on public.saved_searches for delete using (auth.uid() = user_id);

-- shipping_quotes ------------------------------------------------------
drop policy if exists "everyone can read shipping quotes" on public.shipping_quotes;
create policy "everyone can read shipping quotes"
  on public.shipping_quotes for select using (true);

drop policy if exists "users insert shipping quotes" on public.shipping_quotes;
create policy "users insert shipping quotes"
  on public.shipping_quotes for insert with check (auth.uid() = buyer_id or buyer_id is null);

-- kyc_submissions ------------------------------------------------------
drop policy if exists "users see own kyc" on public.kyc_submissions;
create policy "users see own kyc"
  on public.kyc_submissions for select
  using (auth.uid() = user_id or public.is_staff(auth.uid()));

drop policy if exists "users insert own kyc" on public.kyc_submissions;
create policy "users insert own kyc"
  on public.kyc_submissions for insert with check (auth.uid() = user_id);

drop policy if exists "staff update kyc" on public.kyc_submissions;
create policy "staff update kyc"
  on public.kyc_submissions for update using (public.is_staff(auth.uid()));

-- push_tokens ----------------------------------------------------------
drop policy if exists "users manage own push tokens" on public.push_tokens;
create policy "users manage own push tokens"
  on public.push_tokens for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

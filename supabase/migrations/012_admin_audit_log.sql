-- Admin audit log — records privileged edits, especially price/reserve/buy-now
-- and end-time changes made to LIVE auctions (Task 5: admin edit on live
-- listings). Server actions insert here; staff can read it. Idempotent.

create table if not exists public.admin_audit_log (
  id          uuid primary key default uuid_generate_v4(),
  actor_id    uuid references public.profiles(id) on delete set null,
  entity_type text not null,                       -- 'vehicle' | 'auction'
  entity_id   uuid not null,
  action      text not null,                       -- 'update_live_auction' | 'reopen_inspection' | ...
  changes     jsonb not null default '{}'::jsonb,  -- { field: { from, to } }
  note        text,
  created_at  timestamptz not null default now()
);

create index if not exists admin_audit_log_entity_idx
  on public.admin_audit_log (entity_type, entity_id, created_at desc);

alter table public.admin_audit_log enable row level security;

-- Read: admins/superadmins only.
drop policy if exists "audit_log_select_staff" on public.admin_audit_log;
create policy "audit_log_select_staff" on public.admin_audit_log
  for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'superadmin')));

-- Write: admins/superadmins only (actor must be themselves).
drop policy if exists "audit_log_insert_staff" on public.admin_audit_log;
create policy "audit_log_insert_staff" on public.admin_audit_log
  for insert to authenticated
  with check (
    actor_id = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'superadmin'))
  );

-- Inspector self-signup (Apple Guideline 3.2: public audience).
-- Anyone can sign up as an inspector and is AUTO-APPROVED (role = 'inspector');
-- admins can review the application and deactivate (set role back to 'buyer').
-- Idempotent.

-- ---------------------------------------------------------------------
-- inspector_applications — the signup details captured at registration.
-- ---------------------------------------------------------------------
create table if not exists public.inspector_applications (
  id                  uuid primary key default uuid_generate_v4(),
  user_id             uuid not null unique references public.profiles(id) on delete cascade,
  full_name           text not null,
  email               text not null,
  phone               text,
  country             text,
  city                text,
  experience          text,
  id_photo_path       text,                      -- path in the private inspector-docs bucket (optional)
  confirmed_standards boolean not null default false,
  status              text not null default 'approved',  -- 'approved' | 'suspended'
  created_at          timestamptz not null default now()
);

create index if not exists idx_inspector_apps_created on public.inspector_applications(created_at desc);
create index if not exists idx_inspector_apps_status  on public.inspector_applications(status);

alter table public.inspector_applications enable row level security;

-- Applicant can create + read their own application; staff read all; staff update (status).
drop policy if exists "users insert own inspector application" on public.inspector_applications;
create policy "users insert own inspector application"
  on public.inspector_applications for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "users read own inspector application" on public.inspector_applications;
create policy "users read own inspector application"
  on public.inspector_applications for select to authenticated
  using (auth.uid() = user_id or public.is_staff(auth.uid()));

drop policy if exists "staff update inspector applications" on public.inspector_applications;
create policy "staff update inspector applications"
  on public.inspector_applications for update to authenticated
  using (public.is_staff(auth.uid()));

-- ---------------------------------------------------------------------
-- Private bucket for the optional ID / business-card photo.
-- Path convention: {user_id}/{filename} — first folder segment scopes access.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('inspector-docs', 'inspector-docs', false, 10485760,
        array['application/pdf', 'image/png', 'image/jpeg'])
on conflict (id) do update set
  public             = false,
  file_size_limit    = 10485760,
  allowed_mime_types = array['application/pdf', 'image/png', 'image/jpeg'];

-- Upload: the applicant writes only into their own {user_id}/ folder.
drop policy if exists "inspector_docs_insert_owner" on storage.objects;
create policy "inspector_docs_insert_owner" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'inspector-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Read: the owner or any admin/superadmin/inspector-staff.
drop policy if exists "inspector_docs_select_owner_or_staff" on storage.objects;
create policy "inspector_docs_select_owner_or_staff" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'inspector-docs'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_staff(auth.uid())
    )
  );

-- Delete: owner or admin (cleanup).
drop policy if exists "inspector_docs_delete_owner_or_admin" on storage.objects;
create policy "inspector_docs_delete_owner_or_admin" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'inspector-docs'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin(auth.uid())
    )
  );

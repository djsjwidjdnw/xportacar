-- Vehicle photos storage bucket + RLS.
--
-- Background: the 'vehicle-photos' bucket was only ever created on-demand by
-- the web app's service-role client (src/lib/platform-settings.ts) and had NO
-- storage.objects policies. The inspector mobile app uploads with the
-- *authenticated* (anon-key) client, which cannot createBucket and is denied
-- by RLS — so inspection photos failed with "Bucket not found" / RLS errors
-- and never reached Storage. This migration makes the bucket explicit and adds
-- the policies the inspector app needs.
--
-- This is a PUBLIC bucket (vehicle photos are buyer-facing marketing content):
-- the web app stores the full public URL in vehicle_photos.url and renders it
-- directly (see src/lib/utils.ts `thumb()`), so no signed-URL flow is needed.
-- (Contrast: payment-proofs in 009 is private + signed URLs because those are
-- sensitive financial documents.)
--
-- NOTE: this bucket is shared — it also holds platform-settings JSON
-- (_internal/...) and legacy payment-proof files — so we deliberately do NOT
-- set allowed_mime_types here (that would reject those non-image objects).
--
-- MAINTAINER NOTE: the service-role key BYPASSES every RLS policy below, so the
-- web app's service-role writes (platform-settings.ts, legacy payment proofs)
-- keep working regardless. Do NOT add 'service_role' to any policy's `to`
-- clause. The update/delete policies use storage.objects.owner, which Supabase
-- auto-populates with auth.uid() on insert — uploadOne() must not set it.

-- 1) Bucket: public, 25 MB/file. Idempotent; only forces `public` on conflict
--    so any existing size/mime config the app set is preserved.
insert into storage.buckets (id, name, public, file_size_limit)
values ('vehicle-photos', 'vehicle-photos', true, 26214400)
on conflict (id) do update set public = true;

-- 2) RLS policies on storage.objects (RLS is already enabled by Supabase).
--    Re-runnable: drop-if-exists before create.

-- Public read: the buyer marketplace serves photos via the public URL, but an
-- explicit SELECT policy also permits client list/download. Scoped to this
-- bucket only (does not affect payment-proofs / other buckets).
drop policy if exists "vehicle_photos_public_read" on storage.objects;
create policy "vehicle_photos_public_read" on storage.objects
  for select to public
  using (bucket_id = 'vehicle-photos');

-- Upload: signed-in staff only (inspectors + admins). Buyers cannot write here.
-- NOTE: the inspector wizard uploads photos BEFORE the vehicle row exists (new
-- walk-in inspections), and the object path is keyed by user id, not vehicle id
-- — so per-vehicle scoping is not enforceable at the storage layer here; we
-- scope by staff role instead.
drop policy if exists "vehicle_photos_staff_insert" on storage.objects;
create policy "vehicle_photos_staff_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'vehicle-photos'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('inspector', 'admin', 'superadmin')
    )
  );

-- Update: the uploader (owner) or an admin (re-takes / corrections).
drop policy if exists "vehicle_photos_staff_update" on storage.objects;
create policy "vehicle_photos_staff_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'vehicle-photos'
    and (
      owner = auth.uid()
      or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'superadmin'))
    )
  );

-- Delete: the uploader (owner) or an admin (cleanup).
drop policy if exists "vehicle_photos_staff_delete" on storage.objects;
create policy "vehicle_photos_staff_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'vehicle-photos'
    and (
      owner = auth.uid()
      or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'superadmin'))
    )
  );

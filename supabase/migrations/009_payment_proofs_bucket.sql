-- Dedicated PRIVATE bucket for payment proofs (sensitive financial documents).
-- Path convention: {invoice_id}/{filename} — the first folder segment is the
-- invoice id, which the policies use to scope access.

-- 1) Bucket: private, 10MB limit, PDF/PNG/JPEG only. Idempotent.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-proofs', 'payment-proofs', false, 10485760,
        array['application/pdf', 'image/png', 'image/jpeg'])
on conflict (id) do update set
  public             = false,
  file_size_limit    = 10485760,
  allowed_mime_types = array['application/pdf', 'image/png', 'image/jpeg'];

-- 2) RLS policies on storage.objects (RLS is already enabled by Supabase).
-- Re-runnable: drop-if-exists before create.

-- Upload: only the buyer who owns the invoice can write into that invoice's folder.
drop policy if exists "payment_proofs_insert_owner" on storage.objects;
create policy "payment_proofs_insert_owner" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'payment-proofs'
    and exists (
      select 1 from public.invoices i
      where i.id::text = (storage.foldername(name))[1]
        and i.buyer_id = auth.uid()
    )
  );

-- Read/list: the owning buyer OR an admin/superadmin. Because the predicate is
-- scoped to the invoice folder, a buyer can only list/read their own folder —
-- they cannot enumerate other invoices' folders.
drop policy if exists "payment_proofs_select_owner_or_admin" on storage.objects;
create policy "payment_proofs_select_owner_or_admin" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'payment-proofs'
    and (
      exists (
        select 1 from public.invoices i
        where i.id::text = (storage.foldername(name))[1]
          and i.buyer_id = auth.uid()
      )
      or exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.role in ('admin', 'superadmin')
      )
    )
  );

-- Update/delete: owning buyer or admin (so a buyer can re-upload/replace).
drop policy if exists "payment_proofs_modify_owner_or_admin" on storage.objects;
create policy "payment_proofs_modify_owner_or_admin" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'payment-proofs'
    and (
      exists (
        select 1 from public.invoices i
        where i.id::text = (storage.foldername(name))[1] and i.buyer_id = auth.uid()
      )
      or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','superadmin'))
    )
  );

drop policy if exists "payment_proofs_delete_owner_or_admin" on storage.objects;
create policy "payment_proofs_delete_owner_or_admin" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'payment-proofs'
    and (
      exists (
        select 1 from public.invoices i
        where i.id::text = (storage.foldername(name))[1] and i.buyer_id = auth.uid()
      )
      or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','superadmin'))
    )
  );

-- Note: no SELECT policy is added on storage.buckets, so authenticated users
-- cannot list/enumerate buckets. The web app uploads via the service-role key
-- (bypasses RLS) and serves proofs to admins via 7-day signed URLs.

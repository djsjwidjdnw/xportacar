-- Payment proof upload + admin verification.
--   payment_confirmed_at : buyer says they have paid (set on proof submit)
--   payment_verified_at  : admin confirms the money was actually received
alter table public.invoices
  add column if not exists payment_proof_urls jsonb not null default '[]'::jsonb,
  add column if not exists payment_proof_note text,
  add column if not exists payment_verified_at timestamptz;

-- Files are uploaded to the existing public "vehicle-photos" bucket under
-- invoices/{invoice_id}/payment_proof/{filename} (the web app uploads via the
-- service role; the mobile app uploads with the authenticated buyer's client
-- using the existing bucket policy), so no new storage bucket is required.

-- Buyer-callable RPC used by the mobile app to persist proof URLs + note,
-- mark payment_confirmed_at, and notify admins to verify receipt — all in one
-- call (RLS does not grant buyers UPDATE on invoices). The web app does the
-- same work via the service-role client in submitPaymentProofAction.
create or replace function public.submit_payment_proof(
  p_invoice_id uuid, p_urls jsonb, p_note text
) returns void language plpgsql security definer set search_path = public as $$
declare v_auction uuid; v_buyer uuid; v_who text;
begin
  select auction_id, buyer_id into v_auction, v_buyer
    from public.invoices where id = p_invoice_id and buyer_id = auth.uid();
  if v_buyer is null then return; end if;

  update public.invoices
     set payment_proof_urls   = coalesce(p_urls, '[]'::jsonb),
         payment_proof_note   = nullif(p_note, ''),
         payment_confirmed_at = coalesce(payment_confirmed_at, now())
   where id = p_invoice_id;

  select coalesce(company_name, full_name, email, 'A buyer') into v_who
    from public.profiles where id = v_buyer;

  insert into public.notifications (user_id, type, title, body, data)
  select pr.id, 'status_update', 'Payment proof submitted',
         v_who || ' submitted payment proof for invoice ' || left(p_invoice_id::text, 8) || '.',
         jsonb_build_object('invoice_id', p_invoice_id, 'auction_id', v_auction)
    from public.profiles pr where pr.role in ('admin', 'superadmin');
end $$;
grant execute on function public.submit_payment_proof(uuid, jsonb, text) to authenticated;

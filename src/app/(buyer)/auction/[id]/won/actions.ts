"use server";

// Server actions for the post-auction confirmation page — payment-intent
// confirmation (36h window) and Stripe Checkout creation for the invoice.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe, isStripeConfigured } from "@/lib/stripe";

// Step 1 of the two-step win flow: the buyer confirms (within 36h of winning)
// that they intend to pay. This starts the 5-working-day wire-transfer clock.
export async function confirmPaymentAction(input: {
  invoiceId: string;
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in to confirm payment." };

  const { data: invoice } = await supabase
    .from("invoices")
    .select("id, buyer_id, auction_id, payment_confirmed_at")
    .eq("id", input.invoiceId)
    .single();

  if (!invoice || (invoice as { buyer_id: string }).buyer_id !== user.id) {
    return { ok: false, error: "Invoice not found." };
  }
  if ((invoice as { payment_confirmed_at: string | null }).payment_confirmed_at) {
    return { ok: true }; // already confirmed — idempotent
  }

  // Use the service-role client: RLS on invoices does not grant buyers UPDATE.
  const admin = createAdminClient();
  const { error } = await admin
    .from("invoices")
    .update({ payment_confirmed_at: new Date().toISOString() })
    .eq("id", input.invoiceId);
  if (error) return { ok: false, error: error.message };

  const auctionId = (invoice as { auction_id: string }).auction_id;
  revalidatePath(`/auction/${auctionId}/won`);
  revalidatePath("/dashboard");
  return { ok: true };
}

// Payment proof upload — files + optional note. Uploads server-side with the
// service-role client (bypasses storage RLS), records the URLs + note on the
// invoice, marks payment_confirmed_at, and notifies admins to verify receipt.
const PROOF_ALLOWED_TYPES = new Set(["application/pdf", "image/png", "image/jpeg", "image/jpg"]);
const PROOF_ALLOWED_EXT = /\.(pdf|png|jpe?g)$/i;
const PROOF_MAX_FILES = 5;
const PROOF_MAX_BYTES = 10 * 1024 * 1024;

// The payment-proofs bucket only allows application/pdf, image/png, image/jpeg,
// so normalise the content type (browsers occasionally send "" or image/jpg).
function proofContentType(f: File): string {
  const t = (f.type || "").toLowerCase();
  if (t === "application/pdf" || t === "image/png" || t === "image/jpeg") return t;
  if (t === "image/jpg") return "image/jpeg";
  const ext = f.name.toLowerCase().split(".").pop();
  if (ext === "pdf") return "application/pdf";
  if (ext === "png") return "image/png";
  return "image/jpeg";
}

export async function submitPaymentProofAction(
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in to submit payment proof." };

  const invoiceId = String(formData.get("invoiceId") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);

  if (!invoiceId) return { ok: false, error: "Missing invoice." };
  if (files.length === 0) return { ok: false, error: "Attach at least one file." };
  if (files.length > PROOF_MAX_FILES) return { ok: false, error: `Attach at most ${PROOF_MAX_FILES} files.` };
  for (const f of files) {
    if (f.size > PROOF_MAX_BYTES) return { ok: false, error: `${f.name} is larger than 10MB.` };
    if (!PROOF_ALLOWED_TYPES.has(f.type) && !PROOF_ALLOWED_EXT.test(f.name)) {
      return { ok: false, error: `${f.name}: only PDF, PNG and JPG files are allowed.` };
    }
  }

  const { data: invoice } = await supabase
    .from("invoices")
    .select("id, buyer_id, auction_id")
    .eq("id", invoiceId)
    .single();
  // deno-lint-ignore no-explicit-any
  const inv = invoice as any;
  if (!inv || inv.buyer_id !== user.id) return { ok: false, error: "Invoice not found." };

  const admin = createAdminClient();
  // Private "payment-proofs" bucket. We store the storage KEY (path), not a URL —
  // admins read via short-lived signed URLs (the bucket is not public).
  // Path = {invoice_id}/{file} so the bucket RLS policies can scope by folder.
  const proofs: { path: string; filename: string; uploaded_at: string }[] = [];
  for (const f of files) {
    const safe = f.name.replace(/[^a-zA-Z0-9._-]+/g, "_");
    const key = `${invoiceId}/${Date.now()}-${safe}`;
    const buf = Buffer.from(await f.arrayBuffer());
    const { error: upErr } = await admin.storage
      .from("payment-proofs")
      .upload(key, buf, { contentType: proofContentType(f), upsert: false });
    if (upErr) return { ok: false, error: `Upload failed: ${upErr.message}` };
    proofs.push({ path: key, filename: f.name, uploaded_at: new Date().toISOString() });
  }

  const { error: updErr } = await admin
    .from("invoices")
    .update({
      payment_proof_urls: proofs,
      payment_proof_note: note || null,
      payment_confirmed_at: new Date().toISOString(),
    })
    .eq("id", invoiceId);
  if (updErr) return { ok: false, error: updErr.message };

  // Notify all admins that proof was submitted (to verify receipt).
  const { data: profile } = await supabase
    .from("profiles").select("full_name, company_name, email").eq("id", user.id).single();
  // deno-lint-ignore no-explicit-any
  const p = profile as any;
  const who = p?.company_name ?? p?.full_name ?? p?.email ?? "A buyer";
  const { data: admins } = await admin.from("profiles").select("id").in("role", ["admin", "superadmin"]);
  if (admins && admins.length) {
    await admin.from("notifications").insert(
      (admins as { id: string }[]).map((a) => ({
        user_id: a.id,
        type: "status_update",
        title: "Payment proof submitted",
        body: `${who} submitted payment proof for invoice ${invoiceId.slice(0, 8)}.`,
        data: { invoice_id: invoiceId, auction_id: inv.auction_id },
      })),
    );
  }

  revalidatePath(`/auction/${inv.auction_id}/won`);
  revalidatePath("/admin/invoices");
  revalidatePath(`/admin/invoices/${invoiceId}`);
  return { ok: true };
}

export interface CheckoutResult {
  ok: boolean;
  url?: string;
  error?: string;
  configured?: boolean;
}

export async function createCheckoutSessionAction(input: {
  invoiceId: string;
}): Promise<CheckoutResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in to pay." };

  if (!isStripeConfigured()) {
    return { ok: false, configured: false, error: "Payment processing coming soon." };
  }

  const { data: invoice } = await supabase
    .from("invoices")
    .select(`
      id, total_eur, status, invoice_number, stripe_session_id,
      vehicle:vehicles!vehicle_id ( year, make, model )
    `)
    .eq("id", input.invoiceId)
    .eq("buyer_id", user.id)
    .single();

  if (!invoice) return { ok: false, error: "Invoice not found." };
  if (invoice.status === "paid") return { ok: false, error: "Invoice already paid." };

  const stripe = await getStripe();
  if (!stripe) return { ok: false, configured: false, error: "Payment processing coming soon." };

  // deno-lint-ignore no-explicit-any
  const v = (invoice as any).vehicle;
  const productName = v ? `${v.year} ${v.make} ${v.model}` : "XportACar auction";
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [{
      price_data: {
        currency: "eur",
        product_data: {
          name: productName,
          description: `Invoice ${invoice.invoice_number ?? invoice.id.slice(0, 8)}`,
        },
        unit_amount: Math.round(Number(invoice.total_eur) * 100),
      },
      quantity: 1,
    }],
    success_url: `${site}/dashboard?paid=${invoice.id}`,
    cancel_url:  `${site}/dashboard`,
    metadata: { invoice_id: invoice.id, buyer_id: user.id },
  });

  // Record the session id so the webhook can mark it paid.
  const admin = createAdminClient();
  await admin.from("invoices").update({ stripe_session_id: session.id }).eq("id", invoice.id);

  return { ok: true, url: session.url ?? undefined };
}

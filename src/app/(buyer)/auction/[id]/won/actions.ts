"use server";

// Server actions for the post-auction confirmation page — payment-intent
// confirmation (36h window) and Stripe Checkout creation for the invoice.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { sendPaymentReceivedAdminEmail, sendInvoiceEmail } from "@/lib/email";
import { renderInvoicePdf } from "@/lib/invoice/pdf";

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
    .select("id, buyer_id, auction_id, invoice_number, total_eur")
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
  const { data: admins } = await admin
    .from("profiles").select("id, email, language").in("role", ["admin", "superadmin"]);
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
    // Email admins too (best-effort, localized to each admin's language).
    try {
      for (const a of admins as { email?: string; language?: string }[]) {
        if (!a.email) continue;
        await sendPaymentReceivedAdminEmail({
          to: a.email,
          buyerName: who,
          invoiceNumber: inv.invoice_number ?? invoiceId.slice(0, 8),
          amountEur: Number(inv.total_eur ?? 0),
          invoiceId,
          locale: a.language,
        });
      }
    } catch { /* email is best-effort */ }
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

// --------------------------------------------------------------------
// Finalize the buyer's shipping + extras selection onto the invoice, so the
// chosen breakdown is durable (dashboard, PDF, admin). Recomputes the total =
// hammer + platform fee (2.9%) + shipping + extras. Owner-gated.
// --------------------------------------------------------------------
const PLATFORM_FEE_PCT = 0.029;

export async function finalizeInvoiceShippingAction(input: {
  invoiceId: string;
  shippingMethod: "standard" | "door_to_door";
  shippingEur: number;
  distanceKm?: number | null;
  shippingAddress?: string | null;
  // Structured door-to-door address (from the autofill). Optional so standard
  // shipping (no address) keeps working unchanged.
  shippingLine1?: string | null;
  shippingLine2?: string | null;
  shippingCity?: string | null;
  shippingPostalCode?: string | null;
  shippingCountry?: string | null; // ISO 3166-1 alpha-2
  shippingLatitude?: number | null;
  shippingLongitude?: number | null;
  extras?: { name: string; price_eur: number }[];
}): Promise<{ ok: boolean; error?: string; totalEur?: number }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in to confirm your order." };

  const { data: inv } = await supabase
    .from("invoices")
    .select("id, buyer_id, amount_eur, invoice_number, vehicle:vehicles!vehicle_id(year, make, model, trim), buyer:profiles!buyer_id(email, language)")
    .eq("id", input.invoiceId)
    .single();
  // deno-lint-ignore no-explicit-any
  const i = inv as any;
  if (!i || i.buyer_id !== user.id) return { ok: false, error: "Invoice not found." };

  const extras = Array.isArray(input.extras) ? input.extras : [];
  const extrasEur = extras.reduce((s, e) => s + (Number(e.price_eur) || 0), 0);
  const shippingEur = Math.max(0, Number(input.shippingEur) || 0);
  const hammer = Number(i.amount_eur) || 0;
  const feeEur = Math.round(hammer * PLATFORM_FEE_PCT * 100) / 100;
  const totalEur = Math.round((hammer + feeEur + shippingEur + extrasEur) * 100) / 100;

  // Build a formatted single-string address from the structured fields (used by
  // the PDF + email which read shipping_address). Falls back to the legacy
  // free-text shippingAddress if no structured fields were provided.
  const structuredLines = [
    input.shippingLine1?.trim(),
    input.shippingLine2?.trim(),
    [input.shippingPostalCode?.trim(), input.shippingCity?.trim()].filter(Boolean).join(" "),
    input.shippingCountry?.trim()?.toUpperCase(),
  ].filter((l): l is string => !!l && l.length > 0);
  const formattedAddress =
    structuredLines.length > 0 ? structuredLines.join("\n") : (input.shippingAddress?.trim() || null);

  // RLS does not grant buyers UPDATE on invoices → use the service-role client.
  const admin = createAdminClient();
  const { error } = await admin
    .from("invoices")
    .update({
      shipping_method: input.shippingMethod,
      shipping_eur: shippingEur,
      shipping_distance_km: input.distanceKm ?? null,
      shipping_address: formattedAddress,
      shipping_line1: input.shippingLine1?.trim() || null,
      shipping_line2: input.shippingLine2?.trim() || null,
      shipping_city: input.shippingCity?.trim() || null,
      shipping_postal_code: input.shippingPostalCode?.trim() || null,
      shipping_country: input.shippingCountry?.trim()?.toUpperCase() || null,
      shipping_latitude: input.shippingLatitude ?? null,
      shipping_longitude: input.shippingLongitude ?? null,
      extras,
      extras_eur: extrasEur,
      total_eur: totalEur,
    })
    .eq("id", input.invoiceId);
  if (error) return { ok: false, error: error.message };

  // Send the invoice email now that the total is finalized — this is the
  // unified completion point for BOTH Buy Now and timer-won orders (both reach
  // the won page and finalise shipping here). Best-effort: never block the
  // order on email. Includes the full breakdown + wire/bank details + PDF link.
  try {
    const veh = Array.isArray(i.vehicle) ? i.vehicle[0] : i.vehicle;
    const buyer = Array.isArray(i.buyer) ? i.buyer[0] : i.buyer;
    const vehicleTitle = veh
      ? `${veh.year} ${veh.make} ${veh.model}${veh.trim ? ` ${veh.trim}` : ""}`
      : "Vehicle";
    const shippingLabel =
      input.shippingMethod === "door_to_door"
        ? (input.distanceKm ? `Door-to-door delivery (${input.distanceKm} km)` : "Door-to-door delivery")
        : "Standard port shipping";
    if (buyer?.email) {
      // Attach the actual rendered PDF (same document the /pdf route serves).
      // Best-effort: if rendering fails, send the email without the attachment.
      let attachments: { filename: string; content: Buffer }[] | undefined;
      try {
        const pdf = await renderInvoicePdf(input.invoiceId);
        if (pdf) attachments = [{ filename: `invoice-${i.invoice_number ?? input.invoiceId.slice(0, 8)}.pdf`, content: pdf.buffer }];
      } catch (e) {
        console.error("[invoice pdf] render-for-email failed:", (e as Error)?.message);
      }
      await sendInvoiceEmail({
        to: buyer.email,
        invoiceNumber: i.invoice_number ?? input.invoiceId.slice(0, 8),
        invoiceId: input.invoiceId,
        vehicleTitle,
        hammerEur: hammer,
        feeEur,
        shippingEur,
        shippingLabel,
        shippingAddress: formattedAddress,
        extras: extras.map((e) => ({ name: e.name, priceEur: Number(e.price_eur) || 0 })),
        totalEur,
        locale: buyer.language,
        attachments,
      });
    }
  } catch (e) {
    console.error("[invoice email] send failed:", (e as Error)?.message);
  }

  revalidatePath("/dashboard");
  return { ok: true, totalEur };
}

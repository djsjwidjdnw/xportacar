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

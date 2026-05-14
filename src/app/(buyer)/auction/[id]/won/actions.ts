"use server";

// Server actions for the post-auction confirmation page — currently
// Stripe Checkout creation for the winning invoice.

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe, isStripeConfigured } from "@/lib/stripe";

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

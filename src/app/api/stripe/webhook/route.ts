import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const stripe = await getStripe();
  const sig = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !sig || !secret) {
    return NextResponse.json({ ok: false, configured: false }, { status: 503 });
  }

  const body = await req.text();
  // deno-lint-ignore no-explicit-any
  let event: any;
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as { metadata?: Record<string, string> };
    const invoiceId = session.metadata?.invoice_id;
    if (invoiceId) {
      const admin = createAdminClient();
      await admin
        .from("invoices")
        .update({ status: "paid", paid_at: new Date().toISOString() })
        .eq("id", invoiceId);
    }
  }

  return NextResponse.json({ received: true });
}

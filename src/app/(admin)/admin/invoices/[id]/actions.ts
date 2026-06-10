"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPaymentVerifiedEmail } from "@/lib/email";

// Admin marks the money as actually received (distinct from the buyer's
// payment_confirmed_at, which only says "I have paid").
export async function verifyPaymentAction(formData: FormData) {
  const invoiceId = String(formData.get("invoiceId") ?? "");
  if (!invoiceId) return;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!me || !["admin", "superadmin"].includes((me as { role: string }).role)) return;

  const admin = createAdminClient();
  await admin
    .from("invoices")
    .update({ payment_verified_at: new Date().toISOString() })
    .eq("id", invoiceId);

  // Email the buyer that their payment is verified (best-effort, localized).
  try {
    const { data: inv } = await admin
      .from("invoices")
      .select("buyer_id, auction_id, invoice_number, total_eur")
      .eq("id", invoiceId)
      .single();
    const i = inv as { buyer_id?: string; auction_id?: string; invoice_number?: string; total_eur?: number } | null;
    if (i?.buyer_id) {
      const { data: buyer } = await admin
        .from("profiles").select("email, full_name, language").eq("id", i.buyer_id).single();
      const b = buyer as { email?: string; full_name?: string; language?: string } | null;
      if (b?.email) {
        await sendPaymentVerifiedEmail({
          to: b.email,
          name: b.full_name ?? "",
          invoiceNumber: i.invoice_number ?? invoiceId.slice(0, 8),
          amountEur: Number(i.total_eur ?? 0),
          auctionId: i.auction_id,
          locale: b.language,
        });
      }
    }
  } catch { /* email is best-effort */ }

  revalidatePath(`/admin/invoices/${invoiceId}`);
}

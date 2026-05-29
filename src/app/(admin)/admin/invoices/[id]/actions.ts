"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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
  revalidatePath(`/admin/invoices/${invoiceId}`);
}

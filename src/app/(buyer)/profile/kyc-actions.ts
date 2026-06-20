"use server";

// Admin KYC review action. Document uploads now go through POST /api/kyc/upload
// (signup token / cookie session / mobile bearer); this file only handles the
// admin approve/reject decision for a buyer.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendKycApprovedEmail, sendKycRejectedEmail } from "@/lib/email";

export interface KycReviewResult {
  ok: boolean;
  error?: string;
}

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { reviewer: null, error: "Not signed in." as const };
  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  const role = (profile as { role?: string } | null)?.role;
  if (!role || !["admin", "superadmin"].includes(role)) {
    return { reviewer: null, error: "Admin only." as const };
  }
  return { reviewer: user, error: null };
}

// Approve or reject a buyer's KYC. Updates the profile (status + audit +
// rejection reason), marks their pending submissions reviewed, notifies them,
// and sends the localized approval/rejection email.
export async function reviewBuyerKycAction(input: {
  userId: string;
  decision: "approved" | "rejected";
  reason?: string;
}): Promise<KycReviewResult> {
  const { reviewer, error } = await requireAdmin();
  if (error || !reviewer) return { ok: false, error: error ?? "Admin only." };

  const { decision } = input;
  const reason = (input.reason ?? "").trim();
  if (decision === "rejected" && reason.length < 10) {
    return { ok: false, error: "Add a rejection reason (at least 10 characters)." };
  }

  const admin = createAdminClient();
  const nowIso = new Date().toISOString();

  const { error: upErr } = await admin
    .from("profiles")
    .update({
      kyc_status:           decision === "approved" ? "verified" : "rejected",
      kyc_reviewed_at:      nowIso,
      kyc_reviewed_by:      reviewer.id,
      kyc_rejection_reason: decision === "approved" ? null : reason,
    })
    .eq("id", input.userId);
  if (upErr) return { ok: false, error: upErr.message };

  // Mark this buyer's pending submissions reviewed (mirror the decision).
  await admin
    .from("kyc_submissions")
    .update({
      status:        decision,
      reviewed_by:   reviewer.id,
      reviewer_note: decision === "rejected" ? reason : null,
      reviewed_at:   nowIso,
    })
    .eq("user_id", input.userId)
    .eq("status", "pending");

  // Notify + email (best-effort; email transport never throws).
  await admin.from("notifications").insert({
    user_id: input.userId,
    type:    "status_update",
    title:   decision === "approved" ? "Account verified" : "Verification needs attention",
    body:    decision === "approved"
      ? "Your trade account is verified — you can now bid and use Buy Now."
      : `Your verification was declined. Reason: ${reason}`,
  });

  const { data: target } = await admin
    .from("profiles").select("email, full_name, language").eq("id", input.userId).maybeSingle();
  const t = target as { email?: string; full_name?: string; language?: string } | null;
  if (t?.email) {
    if (decision === "approved") {
      await sendKycApprovedEmail({ to: t.email, name: t.full_name ?? "", locale: t.language });
    } else {
      await sendKycRejectedEmail({ to: t.email, name: t.full_name ?? "", reason, locale: t.language });
    }
  }

  revalidatePath("/admin/kyc");
  revalidatePath("/admin/users");
  revalidatePath("/pending-verification");
  revalidatePath("/profile");
  return { ok: true };
}

"use server";

// KYC submission server actions.  Stores documents in Supabase Storage
// at kyc/{user_id}/{timestamp}-{filename} and records a submission row.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { KycDocType } from "@/types";

const BUCKET = "kyc-documents";

export interface KycUploadResult {
  ok: boolean;
  error?: string;
  fileUrl?: string;
}

const ALLOWED_DOC_TYPES: KycDocType[] = ["trade_license", "id_document", "utility_bill", "other"];

export async function submitKycDocumentAction(
  _prev: KycUploadResult | undefined,
  formData: FormData,
): Promise<KycUploadResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const file = formData.get("file");
  const documentType = String(formData.get("document_type") ?? "trade_license") as KycDocType;
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Choose a file to upload." };
  }
  if (!ALLOWED_DOC_TYPES.includes(documentType)) {
    return { ok: false, error: "Invalid document type." };
  }
  if (file.size > 8 * 1024 * 1024) {
    return { ok: false, error: "File must be 8 MB or smaller." };
  }

  // Use admin client to handle Storage upload (RLS doesn't apply to storage
  // bucket policies the same way and is simpler to manage from server actions).
  const admin = createAdminClient();

  // Ensure bucket exists.  No-op on subsequent calls.
  try {
    await admin.storage.createBucket(BUCKET, { public: true });
  } catch { /* already exists */ }

  const fileExt = file.name.split(".").pop()?.toLowerCase() ?? "bin";
  const objectKey = `${user.id}/${Date.now()}-${documentType}.${fileExt}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await admin.storage
    .from(BUCKET)
    .upload(objectKey, buffer, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
  if (upErr) return { ok: false, error: upErr.message };

  const { data: publicUrl } = admin.storage.from(BUCKET).getPublicUrl(objectKey);

  const { error: insErr } = await supabase
    .from("kyc_submissions")
    .insert({
      user_id:       user.id,
      document_type: documentType,
      file_url:      publicUrl.publicUrl,
      status:        "pending",
    });
  if (insErr) return { ok: false, error: insErr.message };

  // Mark profile pending (in case it was rejected before).
  await supabase.from("profiles").update({ kyc_status: "pending" }).eq("id", user.id);

  revalidatePath("/profile");
  revalidatePath("/admin/kyc");
  return { ok: true, fileUrl: publicUrl.publicUrl };
}

export async function reviewKycSubmissionAction(input: {
  submissionId: string;
  decision: "approved" | "rejected";
  note?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !["admin", "superadmin"].includes(profile.role)) {
    return { ok: false, error: "Admin only." };
  }

  const admin = createAdminClient();
  const { data: sub } = await admin
    .from("kyc_submissions")
    .select("id, user_id")
    .eq("id", input.submissionId)
    .single();
  if (!sub) return { ok: false, error: "Submission not found." };

  await admin
    .from("kyc_submissions")
    .update({
      status:        input.decision,
      reviewed_by:   user.id,
      reviewer_note: input.note ?? null,
      reviewed_at:   new Date().toISOString(),
    })
    .eq("id", input.submissionId);

  if (input.decision === "approved") {
    await admin
      .from("profiles")
      .update({ kyc_status: "verified" })
      .eq("id", (sub as { user_id: string }).user_id);
  } else {
    await admin
      .from("profiles")
      .update({ kyc_status: "rejected" })
      .eq("id", (sub as { user_id: string }).user_id);
  }

  await admin.from("notifications").insert({
    user_id: (sub as { user_id: string }).user_id,
    type:    "status_update",
    title:   input.decision === "approved" ? "KYC approved" : "KYC needs attention",
    body:    input.decision === "approved"
      ? "Your trade account is verified. Welcome aboard!"
      : `Your KYC was rejected. ${input.note ? `Reason: ${input.note}` : "Please re-submit corrected documents."}`,
  });

  revalidatePath("/admin/kyc");
  revalidatePath("/profile");
  return { ok: true };
}

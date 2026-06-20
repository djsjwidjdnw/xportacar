import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { verifyKycUploadToken } from "@/lib/kyc/uploadToken";
import type { KycDocType, KycIdSubtype } from "@/types";

export const runtime = "nodejs";

const BUCKET = "kyc-documents";
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB per document
const ALLOWED_MIME = new Set(["application/pdf", "image/png", "image/jpeg"]);
const ALLOWED_ID_SUBTYPES: KycIdSubtype[] = ["passport", "drivers_license", "national_id"];

function extFor(file: File): string {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]{1,5}$/.test(fromName)) return fromName;
  if (file.type === "application/pdf") return "pdf";
  if (file.type === "image/png") return "png";
  return "jpg";
}

function badFile(file: unknown): string | null {
  if (!(file instanceof File) || file.size === 0) return "File is missing or empty.";
  if (file.size > MAX_BYTES) return "File must be 10 MB or smaller.";
  if (!ALLOWED_MIME.has(file.type)) return "Use a PDF, JPG, or PNG file.";
  return null;
}

/**
 * Accepts KYC documents and stores them in the private kyc-documents bucket via
 * the service-role client, then records kyc_submissions rows and flips the
 * profile to 'pending'. Authorized by EITHER:
 *   - a one-time upload token (field `token` or `x-kyc-upload-token` header) —
 *     used right after signup when email confirmation is on (no session), OR
 *   - a logged-in session (Authorization: Bearer <access_token>) — used for
 *     re-submission after a rejection.
 *
 * FormData contract:
 *   token?         string
 *   personal_id    File   (required)  -> document_type 'id_document'
 *   id_subtype     string (required)  -> passport | drivers_license | national_id
 *   trade_license? File   (optional)  -> document_type 'trade_license'
 *   is_business?   "true" | "false"
 */
export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "Expected multipart form data." }, { status: 400 });
  }

  // ---- Authorize → resolve the target user id -------------------------------
  const admin = createAdminClient();
  const token = String(form.get("token") ?? req.headers.get("x-kyc-upload-token") ?? "") || null;
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;

  let userId: string | null = null;
  if (token) {
    userId = verifyKycUploadToken(token);          // signup (no session yet)
  } else if (bearer) {
    const { data } = await admin.auth.getUser(bearer); // mobile resubmit
    userId = data.user?.id ?? null;
  } else {
    const sb = await createClient();                // web resubmit (cookie session)
    const { data } = await sb.auth.getUser();
    userId = data.user?.id ?? null;
  }
  if (!userId) {
    return NextResponse.json(
      { ok: false, error: "Not authorized. Your upload link may have expired — sign in and re-submit from your profile." },
      { status: 401 },
    );
  }

  // ---- Validate inputs ------------------------------------------------------
  const personalId = form.get("personal_id");
  const idSubtype = String(form.get("id_subtype") ?? "") as KycIdSubtype;
  const tradeLicense = form.get("trade_license");
  const isBusiness = String(form.get("is_business") ?? "") === "true";

  const idErr = badFile(personalId);
  if (idErr) return NextResponse.json({ ok: false, error: `Personal ID: ${idErr}` }, { status: 400 });
  if (!ALLOWED_ID_SUBTYPES.includes(idSubtype)) {
    return NextResponse.json({ ok: false, error: "Choose a valid ID type." }, { status: 400 });
  }
  const hasTradeLicense = tradeLicense instanceof File && tradeLicense.size > 0;
  if (isBusiness && !hasTradeLicense) {
    return NextResponse.json({ ok: false, error: "A trade licence is required for a business account." }, { status: 400 });
  }
  if (hasTradeLicense) {
    const tlErr = badFile(tradeLicense);
    if (tlErr) return NextResponse.json({ ok: false, error: `Trade licence: ${tlErr}` }, { status: 400 });
  }

  // ---- Self-heal the bucket (no-op once migration 024 is applied) -----------
  try {
    await admin.storage.createBucket(BUCKET, {
      public: false,
      fileSizeLimit: MAX_BYTES,
      allowedMimeTypes: [...ALLOWED_MIME],
    });
  } catch { /* already exists */ }

  // ---- Upload + record each document ---------------------------------------
  const docs: { file: File; documentType: KycDocType; idSubtype: KycIdSubtype | null }[] = [
    { file: personalId as File, documentType: "id_document", idSubtype },
  ];
  if (hasTradeLicense) {
    docs.push({ file: tradeLicense as File, documentType: "trade_license", idSubtype: null });
  }

  const rows: {
    user_id: string;
    document_type: KycDocType;
    id_subtype: KycIdSubtype | null;
    file_url: string;
    status: "pending";
  }[] = [];

  for (const doc of docs) {
    const key = `${userId}/${Date.now()}-${doc.documentType}.${extFor(doc.file)}`;
    const buffer = Buffer.from(await doc.file.arrayBuffer());
    const { error: upErr } = await admin.storage
      .from(BUCKET)
      .upload(key, buffer, { contentType: doc.file.type, upsert: false });
    if (upErr) {
      return NextResponse.json({ ok: false, error: `Upload failed: ${upErr.message}` }, { status: 500 });
    }
    // Store the object KEY (bucket is private); reads resolve a signed URL.
    rows.push({
      user_id: userId,
      document_type: doc.documentType,
      id_subtype: doc.idSubtype,
      file_url: key,
      status: "pending",
    });
  }

  const { error: insErr } = await admin.from("kyc_submissions").insert(rows);
  if (insErr) {
    return NextResponse.json({ ok: false, error: `Could not record submission: ${insErr.message}` }, { status: 500 });
  }

  // Flip the profile to pending and stamp submission time; clear any prior
  // rejection reason. Keep the business flag in sync with what was uploaded.
  await admin
    .from("profiles")
    .update({
      kyc_status: "pending",
      kyc_is_business: isBusiness,
      kyc_submitted_at: new Date().toISOString(),
      kyc_rejection_reason: null,
    })
    .eq("id", userId);

  return NextResponse.json({ ok: true });
}

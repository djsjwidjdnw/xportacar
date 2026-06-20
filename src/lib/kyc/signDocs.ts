import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "kyc-documents";
const TTL_SEC = 60 * 60; // 1 hour

// The kyc-documents bucket is PRIVATE, so kyc_submissions.file_url stores the
// object KEY. Resolve a short-lived signed URL for admin/buyer viewing.
// Back-compat: if a legacy full URL was stored, return it unchanged.
export async function signKycDoc(key: string | null | undefined): Promise<string | null> {
  if (!key) return null;
  if (/^https?:\/\//i.test(key)) return key;
  const admin = createAdminClient();
  const { data } = await admin.storage.from(BUCKET).createSignedUrl(key, TTL_SEC);
  return data?.signedUrl ?? null;
}

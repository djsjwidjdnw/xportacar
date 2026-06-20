import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

// One-time-window, session-free authorization for KYC document upload.
//
// When email confirmation is ON, supabase.auth.signUp returns NO session, so a
// just-registered buyer cannot upload to an owner-scoped storage bucket as
// themselves. Instead the signup step mints this short-lived token bound to the
// new user's id; the buyer POSTs their documents to /api/kyc/upload with it, and
// the server performs the upload with the service-role key. The token is only
// useful in the brief pre-confirmation window and only for that one user id.
//
// Token = "<expEpochSec>.<userId>.<base64url HMAC-SHA256( userId "." exp )>".

const DEFAULT_TTL_SEC = 60 * 60; // 1 hour

// Same key strategy as invoice/signedUrl.ts: prefer SIGNED_URL_SECRET, fall back
// to CRON_SECRET (already in Vercel). Never the service-role key (key separation).
function secret(): string {
  return process.env.SIGNED_URL_SECRET ?? process.env.CRON_SECRET ?? "";
}

export function signKycUploadToken(userId: string, ttlSec = DEFAULT_TTL_SEC): string | null {
  const key = secret();
  if (!key || !userId) return null;
  const exp = Math.floor(Date.now() / 1000) + ttlSec;
  const sig = createHmac("sha256", key).update(`${userId}.${exp}`).digest("base64url");
  return `${exp}.${userId}.${sig}`;
}

// Returns the bound userId when the token is valid + unexpired, else null.
export function verifyKycUploadToken(token: string | null | undefined): string | null {
  const key = secret();
  if (!key || !token) return null;
  const first = token.indexOf(".");
  const last = token.lastIndexOf(".");
  if (first < 1 || last <= first) return null;
  const exp = Number(token.slice(0, first));
  const userId = token.slice(first + 1, last);
  const sig = token.slice(last + 1);
  if (!userId || !Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return null;
  const expected = createHmac("sha256", key).update(`${userId}.${exp}`).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null; // timingSafeEqual throws on length mismatch
  return timingSafeEqual(a, b) ? userId : null;
}

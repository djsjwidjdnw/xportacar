import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

// Login-free, time-limited access to an invoice PDF. Used so mobile Safari (no
// session cookie) and email recipients can open /api/invoice/:id/pdf?token=...
//
// Token = "<expEpochSec>.<base64url HMAC-SHA256( invoiceId "." exp )>".
// The invoice id is bound into the signature, so a token only ever works for
// that one invoice, and only until it expires.

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://xportacar.com";
const DEFAULT_TTL_SEC = 7 * 24 * 60 * 60; // 7 days

// Reuse an existing high-entropy server secret so the feature ships with no new
// env var: prefer a dedicated SIGNED_URL_SECRET, then CRON_SECRET (already set
// in Vercel), then the service-role key. All are server-only — never sent to a
// client, and the HMAC never exposes them.
function secret(): string {
  return (
    process.env.SIGNED_URL_SECRET ??
    process.env.CRON_SECRET ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    ""
  );
}

export function signInvoiceToken(invoiceId: string, ttlSec = DEFAULT_TTL_SEC): string | null {
  const key = secret();
  if (!key) return null;
  const exp = Math.floor(Date.now() / 1000) + ttlSec;
  const sig = createHmac("sha256", key).update(`${invoiceId}.${exp}`).digest("base64url");
  return `${exp}.${sig}`;
}

export function verifyInvoiceToken(invoiceId: string, token: string | null | undefined): boolean {
  const key = secret();
  if (!key || !token) return false;
  const dot = token.indexOf(".");
  if (dot < 1) return false;
  const exp = Number(token.slice(0, dot));
  const sig = token.slice(dot + 1);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return false;
  const expected = createHmac("sha256", key).update(`${invoiceId}.${exp}`).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false; // timingSafeEqual throws on length mismatch
  return timingSafeEqual(a, b);
}

// Absolute, publicly-openable PDF URL (no session needed). Falls back to the
// session-only URL if signing is unavailable (no secret configured).
export function signedInvoicePdfUrl(invoiceId: string, opts?: { download?: boolean; ttlSec?: number }): string {
  const base = `${SITE_URL}/api/invoice/${invoiceId}/pdf`;
  const token = signInvoiceToken(invoiceId, opts?.ttlSec);
  const params = new URLSearchParams();
  if (token) params.set("token", token);
  if (opts?.download) params.set("download", "1");
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

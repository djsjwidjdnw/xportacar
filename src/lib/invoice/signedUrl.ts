import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

// Login-free, time-limited access to an invoice PDF. Used so mobile Safari (no
// session cookie) and email recipients can open /api/invoice/:id/pdf?token=...
//
// Token = "<expEpochSec>.<base64url HMAC-SHA256( invoiceId "." exp )>".
// The invoice id is bound into the signature, so a token only ever works for
// that one invoice, and only until it expires.

// NOTE: `||` not `??` — NEXT_PUBLIC_SITE_URL is set to an EMPTY STRING in prod,
// and `"" ?? x` keeps "", producing a host-less relative URL that Linking.openURL
// (mobile) and email clients can't open. `|| fallback` handles the empty case.
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://xportacar.com").replace(/\/+$/, "");
const DEFAULT_TTL_SEC = 7 * 24 * 60 * 60; // 7 days

// Dedicated signing secret. Prefer SIGNED_URL_SECRET; fall back to CRON_SECRET
// (already set in Vercel) so the feature ships with no new env var. We do NOT
// fall back to the service-role key — that is an RLS-bypassing credential and
// must not double as a URL-signing key (key separation). Both candidates are
// server-only and the HMAC never exposes them. If neither is set, signing
// returns null and the PDF route falls back to session auth (fail-closed).
function secret(): string {
  return process.env.SIGNED_URL_SECRET ?? process.env.CRON_SECRET ?? "";
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
// session-only URL if signing is unavailable (no secret configured). Pass
// `origin` (e.g. the incoming request's origin) to pin the host to exactly what
// the caller used — the most robust option for the mobile app.
export function signedInvoicePdfUrl(
  invoiceId: string,
  opts?: { download?: boolean; ttlSec?: number; origin?: string },
): string {
  const host = (opts?.origin || SITE_URL).replace(/\/+$/, "");
  const base = `${host}/api/invoice/${invoiceId}/pdf`;
  const token = signInvoiceToken(invoiceId, opts?.ttlSec);
  const params = new URLSearchParams();
  if (token) params.set("token", token);
  if (opts?.download) params.set("download", "1");
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

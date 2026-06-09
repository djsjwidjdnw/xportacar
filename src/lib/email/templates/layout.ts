// Shared HTML shell + helpers for all transactional emails.
// Pure (no "server-only" import) so templates stay trivially testable and can
// be previewed/snapshotted without a server context.

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export interface EmailContent {
  subject: string;
  html: string;
}

/** Escape user/admin-supplied free text before interpolating into HTML. */
export function escapeHtml(input: string): string {
  return String(input)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Format an EUR amount for display, e.g. 95000 -> "€95,000". */
export function eur(amount: number): string {
  return `€${Number(amount || 0).toLocaleString("en-GB")}`;
}

/**
 * Branded responsive email shell. `bodyHtml` is treated as trusted HTML the
 * caller has already assembled (escape dynamic values with escapeHtml first).
 */
export function emailShell(opts: {
  heading: string;
  bodyHtml: string;
  ctaUrl?: string;
  ctaLabel?: string;
}): string {
  const { heading, bodyHtml, ctaUrl, ctaLabel } = opts;
  return `<!doctype html>
<html><body style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #eaecf0;overflow:hidden;">
    <div style="background:#1570EF;color:#fff;padding:24px;">
      <h1 style="margin:0;font-size:20px;font-weight:800;letter-spacing:-0.01em;">XportACar</h1>
    </div>
    <div style="padding:24px;color:#101828;">
      <h2 style="margin:0 0 16px;font-size:18px;font-weight:700;">${escapeHtml(heading)}</h2>
      <div style="font-size:14px;line-height:1.6;color:#475467;">${bodyHtml}</div>
      ${
        ctaUrl
          ? `<div style="margin-top:24px;"><a href="${ctaUrl}" style="display:inline-block;background:#1570EF;color:#fff;text-decoration:none;padding:11px 20px;border-radius:8px;font-weight:600;font-size:14px;">${escapeHtml(ctaLabel ?? "Open XportACar")}</a></div>`
          : ""
      }
    </div>
    <div style="border-top:1px solid #eaecf0;padding:16px 24px;font-size:11px;color:#98a2b3;">
      © XportACar — UAE-to-EU vehicle auctions. You're receiving this because you have an XportACar account.
    </div>
  </div>
</body></html>`;
}

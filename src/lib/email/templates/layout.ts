// Shared HTML shell + helpers for all transactional emails.
// Pure (no "server-only" import) so templates stay trivially testable and can
// be previewed/snapshotted without a server context.

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/** The four locales the platform ships translations for. */
export type EmailLocale = "en" | "de" | "fr" | "ar";

const EMAIL_LOCALES: readonly EmailLocale[] = ["en", "de", "fr", "ar"];

/** Coerce an arbitrary language string to a supported EmailLocale ("en" fallback). */
export function toEmailLocale(lang?: string | null): EmailLocale {
  const l = (lang ?? "").trim().toLowerCase();
  return (EMAIL_LOCALES as readonly string[]).includes(l) ? (l as EmailLocale) : "en";
}

/**
 * A localized lookup table keyed by locale. Templates declare their copy as
 * `Localized<T>` with at least an "en" entry; `pickLocale` resolves the active
 * locale with an "en" fallback so missing translations still render.
 */
export type Localized<T> = { en: T } & Partial<Record<EmailLocale, T>>;

/** Resolve a Localized<T> for the active locale, falling back to "en". */
export function pickLocale<T>(table: Localized<T>, locale?: EmailLocale): T {
  return (locale && table[locale]) || table.en;
}

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
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

/** Strip HTML tags and decode the few entities escapeHtml/eur introduce. */
function stripHtml(html: string): string {
  return String(html)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** The manage-preferences line shown in both the HTML footer and text body. */
const MANAGE_LINE_TEXT = `You're receiving this transactional email because you have an XportACar account. Manage preferences: ${SITE_URL}/profile`;

/**
 * Build a plain-text body matching emailShell: heading, the body with tags
 * stripped, the CTA url on its own line, and the manage-preferences footer.
 */
export function emailText(opts: {
  heading: string;
  bodyHtml: string;
  ctaUrl?: string;
  ctaLabel?: string;
}): string {
  const { heading, bodyHtml, ctaUrl, ctaLabel } = opts;
  const parts: string[] = [heading, "", stripHtml(bodyHtml)];
  if (ctaUrl) {
    parts.push("", `${ctaLabel ?? "Open XportACar"}: ${ctaUrl}`);
  }
  parts.push("", "—", MANAGE_LINE_TEXT, "© XportACar — UAE-to-EU vehicle auctions.");
  return parts.join("\n");
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
  dir?: "ltr" | "rtl";
}): string {
  const { heading, bodyHtml, ctaUrl, ctaLabel, dir = "ltr" } = opts;
  const align = dir === "rtl" ? "right" : "left";
  return `<!doctype html>
<html dir="${dir}" lang="${dir === "rtl" ? "ar" : "en"}"><body style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;padding:24px;" dir="${dir}">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #eaecf0;overflow:hidden;text-align:${align};">
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
      You're receiving this transactional email because you have an XportACar account. Manage preferences: <a href="${SITE_URL}/profile" style="color:#1570EF;text-decoration:underline;">${SITE_URL}/profile</a><br/>
      © XportACar — UAE-to-EU vehicle auctions.
    </div>
  </div>
</body></html>`;
}

/**
 * Convenience: assemble an EmailContent (html + text) from one shell spec, so
 * templates declare their copy once. Pass `dir: "rtl"` for Arabic.
 */
export function buildEmail(opts: {
  subject: string;
  heading: string;
  bodyHtml: string;
  ctaUrl?: string;
  ctaLabel?: string;
  dir?: "ltr" | "rtl";
}): EmailContent {
  return {
    subject: opts.subject,
    html: emailShell(opts),
    text: emailText(opts),
  };
}

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ---------------------- Formatting helpers ----------------------

export function formatEur(value: number | null | undefined, locale = "en-GB"): string {
  if (value == null) return "—";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatNumber(value: number | null | undefined, locale = "en-GB"): string {
  if (value == null) return "—";
  return new Intl.NumberFormat(locale).format(value);
}

export function formatKm(value: number | null | undefined, locale = "en-GB"): string {
  if (value == null) return "—";
  return `${formatNumber(value, locale)} km`;
}

// ---------------------- Thumbnail photo selection ----------------------
//
// Pick the single best photo to represent a vehicle in a thumbnail. The
// Front-right 3/4 exterior shot is the most flattering, recognisable framing,
// so we prefer it. Falls back gracefully when captions/categories are missing.
//
// Priority:
//   1. caption matches the front 3/4 / front-right framing,
//   2. caption mentions "front",
//   3. lowest sort_order exterior photo,
//   4. lowest sort_order photo overall.
export interface ThumbCandidate {
  url: string;
  sort_order?: number | null;
  caption?: string | null;
  category?: string | null;
}

const FRONT_THREE_QUARTER_RE = /front.*(three[- ]?quarter|3\/4|right)/i;
const FRONT_RE = /front/i;

export function pickThumbnailPhoto<T extends ThumbCandidate>(
  photos: readonly T[] | null | undefined,
): T | undefined {
  if (!photos || photos.length === 0) return undefined;
  const byOrder = [...photos].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
  );
  return (
    byOrder.find((p) => p.caption && FRONT_THREE_QUARTER_RE.test(p.caption)) ??
    byOrder.find((p) => p.caption && FRONT_RE.test(p.caption)) ??
    byOrder.find((p) => p.category === "exterior") ??
    byOrder[0]
  );
}

// ---------------------- Image thumbnails ----------------------
//
// Listing/grid views must NOT download full-size photos — at 100k vehicles ×
// 10+ photos that's catastrophic. `thumb()` returns a small (default 600px,
// ~300px @2x) variant for cards; detail pages keep the original. Handles:
//   • Supabase Storage public URLs → the image render/transform endpoint
//     (requires Storage image transformation enabled on the project),
//   • Unsplash CDN URLs → w/q/auto/fit params,
//   • anything else → returned unchanged.
export function thumb(url: string | null | undefined, width = 600): string {
  if (!url) return "";
  try {
    const u = new URL(url);
    if (u.pathname.includes("/storage/v1/object/public/")) {
      u.pathname = u.pathname.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/");
      u.searchParams.set("width", String(width));
      // 4:3 height + resize=cover → Supabase center-crops the source server-side
      // (tall portrait phone photos are cropped to fit, not letterboxed). The
      // card then displays a true 4:3 image with object-cover.
      u.searchParams.set("height", String(Math.round((width * 3) / 4)));
      u.searchParams.set("quality", "70");
      u.searchParams.set("resize", "cover");
      return u.toString();
    }
    if (u.hostname.includes("images.unsplash.com")) {
      u.searchParams.set("w", String(width));
      u.searchParams.set("q", "70");
      u.searchParams.set("auto", "format");
      u.searchParams.set("fit", "crop");
      return u.toString();
    }
    return url;
  } catch {
    return url;
  }
}

// Compact "ending in 4d 2h" / "12h 34m" / "23m 11s"
export function formatTimeRemaining(endIso: string, now = new Date()): string {
  const ms = new Date(endIso).getTime() - now.getTime();
  if (ms <= 0) return "Ended";
  const sec = Math.floor(ms / 1000);
  const d = Math.floor(sec / 86_400);
  const h = Math.floor((sec % 86_400) / 3_600);
  const m = Math.floor((sec % 3_600) / 60);
  const s = sec % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

// HH:MM:SS for the auction page countdown
export function formatCountdown(endIso: string, now = new Date()): {
  hours: string; minutes: string; seconds: string; ended: boolean;
} {
  const ms = new Date(endIso).getTime() - now.getTime();
  if (ms <= 0) return { hours: "00", minutes: "00", seconds: "00", ended: true };
  const sec = Math.floor(ms / 1000);
  const h = Math.floor(sec / 3_600);
  const m = Math.floor((sec % 3_600) / 60);
  const s = sec % 60;
  return {
    hours:   String(h).padStart(2, "0"),
    minutes: String(m).padStart(2, "0"),
    seconds: String(s).padStart(2, "0"),
    ended: false,
  };
}

export function formatRelativeTime(iso: string, locale = "en-GB"): string {
  const ms = new Date(iso).getTime() - Date.now();
  const sec = Math.round(ms / 1000);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const abs = Math.abs(sec);
  if (abs < 60)        return rtf.format(sec, "second");
  if (abs < 3_600)     return rtf.format(Math.round(sec / 60), "minute");
  if (abs < 86_400)    return rtf.format(Math.round(sec / 3_600), "hour");
  if (abs < 2_592_000) return rtf.format(Math.round(sec / 86_400), "day");
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(iso));
}

// ---------------------- Auction state ----------------------
//
// The DB `status` column lags reality: there is no job that flips a
// naturally-expired auction from `active` to `ended`.  So the *effective*
// phase must always be derived by comparing `end_time` to the clock — never
// trust `status === "active"` on its own.  This is the single source of
// truth used by every surface (cards, bid panel, price card, pages).

export type AuctionPhase = "scheduled" | "live" | "ended";

interface AuctionTimes {
  status?: string | null;
  start_time?: string | null;
  end_time?: string | null;
}

/** Effective phase of an auction, or null when there is no auction. */
export function auctionPhase(
  auction: AuctionTimes | null | undefined,
  now: number = Date.now(),
): AuctionPhase | null {
  if (!auction) return null;
  const { status } = auction;

  // Terminal DB states are always ended.
  if (status === "sold" || status === "ended" || status === "cancelled") return "ended";

  // A passed end_time means ended regardless of a stale `active` status.
  const end = auction.end_time ? new Date(auction.end_time).getTime() : null;
  if (end != null && Number.isFinite(end) && end <= now) return "ended";

  // Not started yet.
  const start = auction.start_time ? new Date(auction.start_time).getTime() : null;
  if (status === "scheduled" || (start != null && Number.isFinite(start) && start > now)) {
    return "scheduled";
  }

  if (status === "active") return "live";
  return null;
}

/** True when a live auction ends within `withinMs` (default 1 hour). */
export function isEndingSoon(
  auction: AuctionTimes | null | undefined,
  now: number = Date.now(),
  withinMs = 3_600_000,
): boolean {
  if (auctionPhase(auction, now) !== "live" || !auction?.end_time) return false;
  const ms = new Date(auction.end_time).getTime() - now;
  return ms > 0 && ms <= withinMs;
}

export function initials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .trim()
    .split(/\s+/)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .slice(0, 2)
    .join("");
}

// ---------------------- Admin notification links ----------------------
//
// Resolve the admin-side destination for a `notifications` row (or any
// notification-shaped activity item) from its type + jsonb `data`. Used by the
// admin dashboard "Recent activity" feed and the /admin/activity page so each
// card/row is a working link into the relevant admin record.
//
// Mapping (most-specific first):
//   • status_update + data.vehicle_id (new listing / inspection) → vehicle
//   • payment proof / invoice (data.invoice_id)                  → invoice
//   • inspector application (title mentions "inspector", no id)  → inspectors
//   • fallbacks: vehicle_id → vehicle; invoice_id → invoice;
//     auction_id → auctions list; else null (no link).
export function adminNotificationHref(
  type: string | null | undefined,
  data: Record<string, unknown> | null | undefined,
  title?: string | null,
): string | null {
  const d = (data ?? {}) as {
    vehicle_id?: unknown;
    invoice_id?: unknown;
    auction_id?: unknown;
  };
  const vehicleId = typeof d.vehicle_id === "string" ? d.vehicle_id : null;
  const invoiceId = typeof d.invoice_id === "string" ? d.invoice_id : null;
  const auctionId = typeof d.auction_id === "string" ? d.auction_id : null;
  const mentionsInspector = !!title && /inspector/i.test(title);

  // status_update tied to a vehicle (new listing / inspection submitted).
  if (type === "status_update" && vehicleId) return `/admin/vehicles/${vehicleId}`;

  // Payment proof / invoice notifications.
  if (invoiceId) return `/admin/invoices/${invoiceId}`;

  // New inspector application — no specific record id, route to the roster.
  if (mentionsInspector && !vehicleId && !auctionId) return "/admin/inspectors";

  // Generic fallbacks by available id.
  if (vehicleId) return `/admin/vehicles/${vehicleId}`;
  if (auctionId) return "/admin/auctions";

  return null;
}

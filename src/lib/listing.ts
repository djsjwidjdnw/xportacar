// Fixed-price listing state, shared by server and client code.
//
// A listing is the vehicle's single `auctions` row (vehicle_id is unique):
// status 'active', start_time = publish time, end_time = publish + 7 days,
// buy_now_price_eur = the fixed price (bought through the buy_now() RPC).
// Time is the source of truth for expiry: a listing whose end_time has passed
// is expired even before the close-expired-auctions sweep flips its status.

export const LISTING_DAYS = 7;
export const LISTING_MS = LISTING_DAYS * 86_400_000;

export type ListingState = "live" | "expired" | "sold" | "none";

export interface ListingTimes {
  status?: string | null;
  start_time?: string | null;
  end_time?: string | null;
}

export function listingState(a: ListingTimes | null | undefined, now: number = Date.now()): ListingState {
  if (!a) return "none";
  if (a.status === "sold") return "sold";
  if (a.status === "ended" || a.status === "cancelled") return "expired";
  const end = a.end_time ? new Date(a.end_time).getTime() : NaN;
  if (Number.isFinite(end) && end <= now) return "expired";
  const start = a.start_time ? new Date(a.start_time).getTime() : NaN;
  if (a.status === "active" && (!Number.isFinite(start) || start <= now)) return "live";
  return "none"; // scheduled / not yet published
}

/** Whole calendar days left, rounded up (7 right after publishing, 1 on the last day). */
export function listingDaysLeft(endIso: string | null | undefined, now: number = Date.now()): number {
  if (!endIso) return 0;
  const ms = new Date(endIso).getTime() - now;
  return ms > 0 ? Math.ceil(ms / 86_400_000) : 0;
}

type Translate = (key: string, values?: Record<string, string | number>) => string;

/** "6 days left" / "Last day" in the active language. */
export function daysLeftLabel(t: Translate, endIso: string | null | undefined, now: number = Date.now()): string {
  const d = listingDaysLeft(endIso, now);
  return d <= 1 ? t("listing.lastDay") : t("listing.daysLeft", { count: d });
}

/** The fixed price: the listing's buy-now price, falling back to the vehicle's listed price. */
export function listingPrice(
  a: { buy_now_price_eur?: number | null } | null | undefined,
  v: { listed_price_eur?: number | null; buy_now_price_eur?: number | null },
): number | null {
  return a?.buy_now_price_eur ?? v.buy_now_price_eur ?? v.listed_price_eur ?? null;
}

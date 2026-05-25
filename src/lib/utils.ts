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

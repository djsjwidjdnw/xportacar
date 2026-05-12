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

export function initials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .trim()
    .split(/\s+/)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .slice(0, 2)
    .join("");
}

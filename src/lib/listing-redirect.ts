// Where people land when a car (or its listing) is gone, and how the login
// `next` param is made safe. A deleted car must never strand someone on a
// 404: they go back to the marketplace with a short translated notice.
import type { createClient } from "@/lib/supabase/server";

type ServerSupabase = Awaited<ReturnType<typeof createClient>>;

/** The marketplace with the "This listing is no longer available" notice. */
export const LISTING_UNAVAILABLE_URL = "/marketplace?notice=listing-unavailable";
export const LISTING_UNAVAILABLE_NOTICE = "listing-unavailable";

/**
 * True when a PostgREST `.single()` error means "there is no such row":
 * zero rows (PGRST116) or an id that isn't a valid uuid (22P02).
 */
export function isMissingRow(error: { code?: string } | null | undefined): boolean {
  return !error || error.code === "PGRST116" || error.code === "22P02";
}

/**
 * Only same-site relative paths are allowed after sign-in, so `?next=` can't
 * send anyone to another domain. `/admin` itself has no page and maps to the
 * dashboard.
 */
export function sanitizeNext(raw: unknown, fallback = "/marketplace"): string {
  if (typeof raw !== "string" || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) {
    return fallback;
  }
  let url: URL;
  try {
    url = new URL(raw, "https://xportacar.invalid");
  } catch {
    return fallback;
  }
  if (url.origin !== "https://xportacar.invalid") return fallback;
  const path = url.pathname.replace(/\/+$/, "") || "/";
  if (path === "/admin") return "/admin/dashboard";
  return `${url.pathname}${url.search}${url.hash}`;
}

/**
 * If `next` points at a car or listing that no longer exists (or the user
 * can't see), send them to the marketplace notice instead.
 */
export async function resolveListingNext(supabase: ServerSupabase, next: string): Promise<string> {
  const m = /^\/(vehicle|auction)\/([^/?#]+)/.exec(next);
  if (!m) return next;
  const table = m[1] === "vehicle" ? "vehicles" : "auctions";
  const { data, error } = await supabase.from(table).select("id").eq("id", m[2]).maybeSingle();
  if (data) return next;
  if (isMissingRow(error)) return LISTING_UNAVAILABLE_URL;
  return next; // transient error: let the page itself decide
}

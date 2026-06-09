// Best-effort per-user rate limiter.
//
// IMPORTANT: this is an in-memory, per-warm-instance counter. It does NOT
// persist across cold starts and is NOT shared between concurrently running
// instances, so treat it as a speed-bump against accidental loops / light
// abuse, not a hard guarantee. For strict limits, back it with a Postgres
// table or Upstash/Redis keyed by user id.

const hits = new Map<string, number[]>();

/** Returns true if `key` has exceeded `max` calls within `windowMs`. */
export function rateLimited(key: string, max = 30, windowMs = 60_000): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    hits.set(key, recent);
    return true;
  }
  recent.push(now);
  hits.set(key, recent);
  return false;
}

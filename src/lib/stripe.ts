import "server-only";

// Lazy Stripe singleton.  Returns null if STRIPE_SECRET_KEY isn't set so
// callers can render a "coming soon" state instead of crashing the page.

let _stripe: import("stripe").default | null | undefined;

export async function getStripe() {
  if (_stripe !== undefined) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) { _stripe = null; return _stripe; }
  const Stripe = (await import("stripe")).default;
  _stripe = new Stripe(key, { apiVersion: "2025-03-31.basil" as never });
  return _stripe;
}

export function isStripeConfigured() {
  return !!process.env.STRIPE_SECRET_KEY && !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
}

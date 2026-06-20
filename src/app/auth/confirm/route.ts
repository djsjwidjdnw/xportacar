import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { EmailOtpType } from "@supabase/supabase-js";

export const runtime = "nodejs";

// Confirmation / email-link handler for Supabase Auth. Supports both flows:
//   - token_hash + type  (verifyOtp) — works from any device/browser, so a
//     mobile signup confirmed in the phone's browser succeeds without the
//     original signup session. This is the template we ship (see the dashboard
//     setup notes), e.g. /auth/confirm?token_hash=...&type=signup&next=/...
//   - code               (PKCE exchangeCodeForSession) — the default Supabase
//     ConfirmationURL when SSR/PKCE is in play; only completes a session in the
//     same browser that signed up.
// On success the buyer is redirected to `next` (default /pending-verification),
// already signed in (when the flow can establish a session in this browser).

function safeNext(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/pending-verification";
  return next;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const next = safeNext(url.searchParams.get("next"));
  const tokenHash = url.searchParams.get("token_hash");
  const type = (url.searchParams.get("type") ?? "signup") as EmailOtpType;
  const code = url.searchParams.get("code");

  const supabase = await createClient();

  if (tokenHash) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }

  return NextResponse.redirect(new URL("/login?error=confirm", url.origin));
}

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
  // Normalise backslashes first: the WHATWG URL parser treats "\" as "/", so
  // "/\evil.com" would resolve to a different origin (open redirect).
  const n = (next ?? "").replace(/\\/g, "/");
  if (!n.startsWith("/") || n.startsWith("//")) return "/pending-verification";
  return n;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const next = safeNext(url.searchParams.get("next"));
  const tokenHash = url.searchParams.get("token_hash");
  const type = (url.searchParams.get("type") ?? "signup") as EmailOtpType;
  const code = url.searchParams.get("code");

  const supabase = await createClient();

  // After a successful verify the browser holds a live session. Account
  // separation: inspectors must NOT get a buyer-web session — sign them back
  // out and send them to the inspector confirmation page. Their email is still
  // confirmed (verifyOtp already did that); they sign in via the Inspector app.
  async function finish(): Promise<NextResponse> {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles").select("role").eq("id", user.id).single();
      if ((profile as { role?: string } | null)?.role === "inspector") {
        await supabase.auth.signOut();
        return NextResponse.redirect(new URL("/inspector-confirmed", url.origin));
      }
    }
    return NextResponse.redirect(new URL(next, url.origin));
  }

  if (tokenHash) {
    // Try the template's type first, then the common email-confirmation types,
    // so the handler works whether the template uses type=signup or type=email.
    const candidates = [...new Set([type, "signup", "email"])] as EmailOtpType[];
    for (const ty of candidates) {
      const { error } = await supabase.auth.verifyOtp({ type: ty, token_hash: tokenHash });
      if (!error) return finish();
    }
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return finish();
  }

  return NextResponse.redirect(new URL("/login?error=confirm", url.origin));
}

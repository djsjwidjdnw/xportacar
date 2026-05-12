// Next.js 16 renamed Middleware → Proxy.  We use it to keep Supabase auth
// cookies fresh and to gate the buyer-private and admin routes.
import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  // Bail out gracefully when env vars aren't set yet — lets the chrome render
  // before the user has filled in .env.local.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.next({ request });
  }
  return updateSession(request);
}

export const config = {
  matcher: [
    // Run on every path except _next/static, _next/image, favicon, public assets
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};

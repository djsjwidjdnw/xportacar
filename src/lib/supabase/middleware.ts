// Auth refresh helper called from /proxy.ts (Next.js 16 renamed Middleware → Proxy).
// Refreshes the Supabase session cookie on every navigation so RSC pages see a
// valid session, and gates the /admin/* and /(buyer) protected routes.
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_BUYER_PATHS = ["/dashboard", "/watchlist", "/my-bids"];
const ADMIN_PATH_PREFIX = "/admin";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: do not run any code between createServerClient() and getUser().
  const { data: { user } } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Build a redirect that PRESERVES the freshly-rotated Supabase auth cookies.
  // Without copying them, a redirect drops the refreshed session cookie and the
  // next request looks signed-out — the root cause of "logs out on navigation".
  const redirectTo = (targetPath: string, withNext = false) => {
    const url = request.nextUrl.clone();
    url.pathname = targetPath;
    url.search = "";
    if (withNext) url.searchParams.set("next", pathname);
    const redirectResponse = NextResponse.redirect(url);
    for (const cookie of response.cookies.getAll()) {
      redirectResponse.cookies.set(cookie);
    }
    return redirectResponse;
  };

  // Prefetch requests must never mutate navigation: returning a redirect for a
  // prefetch (or a transient refresh race) is what makes the app feel like it
  // logs out mid-session. Just refresh cookies and pass through.
  const isPrefetch =
    request.headers.get("next-router-prefetch") === "1" ||
    request.headers.get("purpose") === "prefetch" ||
    request.headers.get("sec-purpose")?.includes("prefetch");

  // Buyer-private pages — redirect to login if signed out
  if (
    !user &&
    !isPrefetch &&
    PROTECTED_BUYER_PATHS.some((p) => pathname.startsWith(p))
  ) {
    return redirectTo("/login", true);
  }

  // Admin pages — must be signed in AND have admin/superadmin role
  if (pathname.startsWith(ADMIN_PATH_PREFIX) && !isPrefetch) {
    if (!user) {
      return redirectTo("/login", true);
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || !["admin", "superadmin"].includes(profile.role)) {
      return redirectTo("/");
    }
  }

  return response;
}

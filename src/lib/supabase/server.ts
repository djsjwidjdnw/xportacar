// Server-side Supabase client (Server Components, Server Actions, Route Handlers).
// `cookies()` from next/headers is async in Next.js 15+; we await it here so callers
// can simply `await createClient()`.
//
// See ./client.ts for why we don't pass a Database generic here either.
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // setAll() will fail in RSC contexts where cookies can't be mutated.
            // The proxy middleware refreshes the session, so this is safe to ignore.
          }
        },
      },
    },
  );
}

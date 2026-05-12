// Browser-side Supabase client.  Use this from Client Components and hooks.
//
// We intentionally do NOT pass our `Database` generic — the hand-written type
// in ./types.ts isn't a 1:1 match for what `@supabase/postgrest-js` expects
// for its `Insert`/`Update` overloads, and it's safer to cast at the call
// site (`as Vehicle[]`, `<Profile>().single()`, …) than to fight the typegen.
// Replace this with `createBrowserClient<Database>(...)` once you've run
// `supabase gen types typescript --local > src/lib/supabase/types.ts`.
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

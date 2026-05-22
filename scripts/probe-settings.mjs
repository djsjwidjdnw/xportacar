import { createClient } from "@supabase/supabase-js";
const sb = createClient(
  "https://klettmjnnttajdyajafn.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const { data, error } = await sb.from("platform_settings").select("*").limit(1);
console.log("platform_settings:", error?.message ?? `${data?.length ?? 0} rows`);
if (data?.[0]) console.log(JSON.stringify(data[0], null, 2));

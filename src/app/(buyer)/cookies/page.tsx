import { LegalDocument } from "@/components/legal/LegalDocument";
import { getTranslations } from "@/i18n/server";

// Cookie policy. Lists only what the code actually sets (checked 2026-11-03):
//   cookies   sb-<ref>-auth-token(.0/.1) and -code-verifier (@supabase/ssr,
//             maxAge 400 days, removed on sign-out / after the reset exchange),
//             xpc_locale (src/i18n/provider.tsx, 1 year)
//   storage   localStorage xpc_app_banner_dismissed (AppDownloadBanner),
//             service-worker caches xpc-v3-static / xpc-v3-runtime (public/sw.js)
// No analytics, ads or third-party cookies. Update this page when that changes.
export async function generateMetadata() {
  const t = await getTranslations("cookies");
  return { title: `${t("title")} — XportACar` };
}

export default function CookiesPage() {
  return <LegalDocument namespace="cookies" sectionCount={6} />;
}
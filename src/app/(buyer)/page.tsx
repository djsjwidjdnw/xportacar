import { getAppSettings } from "@/lib/settings";
import { MarketingHome } from "@/components/landing/MarketingHome";
import { PrelaunchLanding } from "@/components/landing/PrelaunchLanding";

// Homepage. When the pre-launch toggle is on (app_settings.landing_mode_enabled)
// the public sees the email-capture landing; otherwise the normal marketing
// homepage. The setting read degrades to the marketing home if the settings
// table isn't present yet (migration 025), so the live site never breaks.
export default async function HomePage() {
  const { landingMode, countdownTarget } = await getAppSettings();
  if (landingMode) return <PrelaunchLanding countdownTarget={countdownTarget} />;
  return <MarketingHome />;
}

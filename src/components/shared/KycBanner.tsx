import Link from "next/link";
import { ShieldAlert } from "lucide-react";

import { getTranslations } from "@/i18n/server";
import type { KycStatus } from "@/types";

// Global nudge for signed-in buyers who aren't verified yet. Rendered in the
// buyer layout; hidden for verified users and signed-out visitors.
export async function KycBanner({ status }: { status: KycStatus | null }) {
  if (status !== "pending" && status !== "rejected") return null;
  const t = await getTranslations("kyc");
  const rejected = status === "rejected";

  return (
    <div className={rejected ? "bg-error-50 text-error-800" : "bg-warning-50 text-warning-800"}>
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm sm:px-6 lg:px-8">
        <ShieldAlert className="h-4 w-4 shrink-0" />
        <span className="flex-1">{rejected ? t("bannerRejected") : t("bannerPending")}</span>
        <Link href="/pending-verification" className="font-semibold underline underline-offset-2">
          {t("bannerCta")}
        </Link>
      </div>
    </div>
  );
}

import Link from "next/link";
import { Clock, MailCheck, ShieldCheck, ShieldX } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { KycResubmit } from "@/components/kyc/KycResubmit";
import { createClient } from "@/lib/supabase/server";
import { getTranslations } from "@/i18n/server";
import type { Profile } from "@/types";

export const metadata = { title: "Verification status" };

export default async function PendingVerificationPage() {
  const supabase = await createClient();
  const t = await getTranslations("kyc");
  const { data: { user } } = await supabase.auth.getUser();

  // Not signed in (e.g. confirmation is on and they haven't confirmed yet).
  if (!user) {
    return (
      <Shell icon={<MailCheck className="h-7 w-7" />} tone="primary" title={t("confirmEmailTitle")} body={t("confirmEmailBody")}>
        <Link href="/login" className={buttonVariants({ className: "h-11 w-full" })}>{t("goToSignIn")}</Link>
      </Shell>
    );
  }

  const { data: p } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  const profile = p as Profile | null;
  const status = profile?.kyc_status ?? "pending";

  if (status === "verified") {
    return (
      <Shell icon={<ShieldCheck className="h-7 w-7" />} tone="success" title={t("verifiedTitle")} body={t("verifiedBody")}>
        <Link href="/marketplace" className={buttonVariants({ className: "h-11 w-full" })}>{t("browseMarketplace")}</Link>
      </Shell>
    );
  }

  if (status === "rejected") {
    return (
      <Shell icon={<ShieldX className="h-7 w-7" />} tone="error" title={t("rejectedTitle")} body={t("rejectedBody")}>
        {profile?.kyc_rejection_reason && (
          <p className="rounded-lg bg-error-50 px-4 py-3 text-left text-sm text-error-700">
            <span className="font-semibold">{t("reasonLabel")}:</span> {profile.kyc_rejection_reason}
          </p>
        )}
        <div className="pt-2 text-left">
          <KycResubmit defaultBusiness={profile?.kyc_is_business ?? false} />
        </div>
      </Shell>
    );
  }

  // pending
  return (
    <Shell icon={<Clock className="h-7 w-7" />} tone="warning" title={t("pendingTitle")} body={t("pendingBody")}>
      <Link href="/marketplace" className={buttonVariants({ variant: "outline", className: "h-11 w-full" })}>{t("browseMarketplace")}</Link>
    </Shell>
  );
}

function Shell({
  icon, tone, title, body, children,
}: {
  icon: React.ReactNode;
  tone: "primary" | "success" | "warning" | "error";
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  const toneCls = {
    primary: "bg-brand-50 text-brand-600",
    success: "bg-success-50 text-success-600",
    warning: "bg-warning-50 text-warning-600",
    error: "bg-error-50 text-error-600",
  }[tone];
  return (
    <div className="bg-grey-50 py-12">
      <div className="mx-auto max-w-lg px-4">
        <div className="rounded-2xl border border-grey-200 bg-white p-8 text-center shadow-xs">
          <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${toneCls}`}>{icon}</div>
          <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-grey-900">{title}</h1>
          <p className="mt-2 text-sm text-grey-600">{body}</p>
          <div className="mt-6 space-y-4">{children}</div>
        </div>
      </div>
    </div>
  );
}

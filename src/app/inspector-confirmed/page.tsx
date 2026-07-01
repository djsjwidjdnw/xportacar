import { MailCheck } from "lucide-react";

import { getTranslations } from "@/i18n/server";

export const metadata = { title: "Email confirmed" };

// Landing page for an INSPECTOR who clicked their email-confirmation link.
// Inspectors sign in from the Inspector app, not the web, so this is a plain
// confirmation with no buyer nav / KYC banner (it lives outside the (buyer)
// route group). Buyers keep landing on /pending-verification.
export default async function InspectorConfirmedPage() {
  const t = await getTranslations("inspectorConfirm");
  return (
    <div className="flex min-h-[60vh] items-center bg-grey-50 py-12">
      <div className="mx-auto max-w-lg px-4">
        <div className="rounded-2xl border border-grey-200 bg-white p-8 text-center shadow-xs">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success-50 text-success-600">
            <MailCheck className="h-7 w-7" />
          </div>
          <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-grey-900">
            {t("title")}
          </h1>
          <p className="mt-2 text-sm text-grey-600">{t("body")}</p>
        </div>
      </div>
    </div>
  );
}

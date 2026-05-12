import Link from "next/link";

import { RegisterForm } from "@/components/auth/RegisterForm";
import { getTranslations } from "@/i18n/server";

export const metadata = { title: "Open a trade account" };

export default async function RegisterPage() {
  const t = await getTranslations("auth");

  return (
    <div className="rounded-2xl border border-grey-200 bg-white p-8 shadow-sm">
      <header className="mb-7 text-center">
        <h1 className="text-2xl font-extrabold text-grey-900">{t("registerTitle")}</h1>
        <p className="mt-2 text-sm text-grey-600">{t("registerSubtitle")}</p>
      </header>

      <RegisterForm />

      <p className="mt-6 text-center text-sm text-grey-600">
        {t("alreadyHave")}{" "}
        <Link href="/login" className="font-semibold text-brand-700 hover:underline">
          {t("loginLink")}
        </Link>
      </p>
    </div>
  );
}

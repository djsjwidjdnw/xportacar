import Link from "next/link";

import { LoginForm } from "@/components/auth/LoginForm";
import { getTranslations } from "@/i18n/server";

export const metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const sp = await searchParams;
  const t = await getTranslations("auth");

  return (
    <div className="rounded-2xl border border-grey-200 bg-white p-8 shadow-sm">
      <header className="mb-7 text-center">
        <h1 className="text-2xl font-extrabold text-grey-900">{t("loginTitle")}</h1>
        <p className="mt-2 text-sm text-grey-600">{t("loginSubtitle")}</p>
      </header>

      <LoginForm next={sp.next ?? "/marketplace"} />

      <p className="mt-6 text-center text-sm text-grey-600">
        {t("noAccount")}{" "}
        <Link href="/register" className="font-semibold text-brand-700 hover:underline">
          {t("registerLink")}
        </Link>
      </p>
    </div>
  );
}

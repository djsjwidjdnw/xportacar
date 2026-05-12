"use client";

import Link from "next/link";
import { Logo } from "@/components/shared/Logo";
import { useTranslations } from "@/i18n/provider";

export function Footer() {
  const t = useTranslations("landing");
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-grey-200 bg-grey-50 mt-auto">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-4">
          <div className="md:col-span-1">
            <Logo />
            <p className="mt-4 max-w-xs text-sm text-grey-600">
              {t("footerTagline")}
            </p>
          </div>

          <FooterCol title={t("footerCol1")} links={[
            { href: "/marketplace", label: t("footerLinkMarketplace") },
            { href: "/auctions",    label: t("footerLinkAuctions") },
          ]}/>

          <FooterCol title={t("footerCol2")} links={[
            { href: "/about",   label: t("footerLinkAbout") },
            { href: "/contact", label: t("footerLinkContact") },
          ]}/>

          <FooterCol title={t("footerCol3")} links={[
            { href: "/help",    label: t("footerLinkHelp") },
            { href: "/terms",   label: t("footerLinkTerms") },
            { href: "/privacy", label: t("footerLinkPrivacy") },
          ]}/>
        </div>

        <div className="mt-12 border-t border-grey-200 pt-6 text-center text-xs text-grey-500">
          {t("footerCopy", { year })}
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  title, links,
}: {
  title: string;
  links: { href: string; label: string }[];
}) {
  return (
    <div>
      <h4 className="text-sm font-semibold text-grey-900">{title}</h4>
      <ul className="mt-4 space-y-3">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="text-sm text-grey-600 transition-colors hover:text-brand-600">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

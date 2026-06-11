"use client";

import Link from "next/link";
import { Mail, MapPin } from "lucide-react";

import { Logo } from "@/components/shared/Logo";
import { useTranslations } from "@/i18n/provider";

export function Footer() {
  const t = useTranslations("landing");
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-grey-200 bg-grey-50 mt-auto">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-12">
          {/* Brand + tagline + contact strip */}
          <div className="lg:col-span-5">
            <Logo />
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-grey-600">
              {t("footerTagline")}
            </p>
            <ul className="mt-6 space-y-2.5 text-sm">
              <li>
                <a href="mailto:simon@xportacar.com" className="inline-flex items-center gap-2 text-grey-700 transition-colors hover:text-brand-700">
                  <Mail className="size-4 text-grey-500" />
                  simon@xportacar.com
                </a>
              </li>
              <li className="flex items-start gap-2 text-grey-700">
                <MapPin className="mt-0.5 size-4 shrink-0 text-grey-500" />
                <span className="max-w-xs leading-relaxed">
                  Meydan Grandstand, 6th Floor, Meydan Road, Nad Al Sheba, Dubai, U.A.E.
                </span>
              </li>
            </ul>
          </div>

          {/* Three nav columns */}
          <div className="grid gap-8 sm:grid-cols-3 lg:col-span-7">
            <FooterCol title={t("footerCol1")} links={[
              { href: "/marketplace", label: t("footerLinkMarketplace") },
              { href: "/auctions",    label: t("footerLinkAuctions") },
              { href: "/watchlist",   label: "Watchlist" },
              { href: "/dashboard",   label: "Dashboard" },
            ]}/>

            <FooterCol title={t("footerCol2")} links={[
              { href: "/about",   label: t("footerLinkAbout") },
              { href: "/contact", label: t("footerLinkContact") },
              { href: "/help",    label: t("footerLinkHelp") },
              { href: "#how",     label: "How it works" },
            ]}/>

            <FooterCol title={t("footerCol3")} links={[
              { href: "/terms",   label: t("footerLinkTerms") },
              { href: "/privacy", label: t("footerLinkPrivacy") },
              { href: "/cookies", label: "Cookie policy" },
              { href: "/imprint", label: "Imprint" },
            ]}/>
          </div>
        </div>

        <div className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-grey-200 pt-6 text-xs text-grey-500">
          <p>{t("footerCopy", { year })}</p>
          <p className="text-grey-400">
            UAE → EUROPE · Inspected · Auctioned · Delivered
          </p>
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
      <h4 className="text-sm font-bold text-grey-900">{title}</h4>
      <ul className="mt-4 space-y-3">
        {links.map((l) => (
          <li key={`${l.href}-${l.label}`}>
            <Link href={l.href} className="text-sm text-grey-600 transition-colors hover:text-brand-700">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

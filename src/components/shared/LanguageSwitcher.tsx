"use client";

// Native click-driven dropdown — bypasses the base-ui Menu so the click
// handler fires synchronously and setLocale (cookie write + reload) runs
// reliably.  Earlier we relied on `render={<Link/>}`-style composition
// which interacted oddly with the cookie/reload timing and caused the
// switcher to silently no-op for some users.

import { useEffect, useRef, useState } from "react";
import { Check, Globe } from "lucide-react";

import { Button } from "@/components/ui/button";
import { LOCALE_NAMES, SUPPORTED_LOCALES, type Locale } from "@/lib/constants";
import { useLocale, useSetLocale, useTranslations } from "@/i18n/provider";
import { cn } from "@/lib/utils";

export function LanguageSwitcher({
  variant = "ghost",
  align = "end",
}: {
  variant?: "ghost" | "outline";
  align?: "start" | "end" | "center";
}) {
  const locale = useLocale();
  const { setLocale, isPending } = useSetLocale();
  const t = useTranslations("nav");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Click-outside dismiss.
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const handleSelect = (l: Locale) => {
    setOpen(false);
    if (l !== locale) setLocale(l);
  };

  return (
    <div ref={ref} className="relative">
      <Button
        type="button"
        variant={variant}
        size="sm"
        disabled={isPending}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <Globe className="size-4" />
        <span className="hidden sm:inline">
          {LOCALE_NAMES[locale].flag}{" "}{LOCALE_NAMES[locale].name}
        </span>
        <span className="sm:hidden">{LOCALE_NAMES[locale].flag}</span>
      </Button>

      {open && (
        <div
          role="listbox"
          className={cn(
            "absolute top-full z-50 mt-1 min-w-44 rounded-lg border border-grey-200 bg-white p-1 shadow-md ring-1 ring-grey-100",
            align === "end" ? "right-0" : align === "start" ? "left-0" : "left-1/2 -translate-x-1/2",
          )}
        >
          <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-grey-500">
            {t("language")}
          </p>
          <div className="my-1 h-px bg-grey-100" />
          {SUPPORTED_LOCALES.map((l: Locale) => (
            <button
              key={l}
              type="button"
              role="option"
              aria-selected={l === locale}
              onClick={() => handleSelect(l)}
              className={cn(
                "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-grey-50",
                l === locale && "font-semibold text-brand-700",
              )}
            >
              <span>
                {LOCALE_NAMES[l].flag}&nbsp;&nbsp;{LOCALE_NAMES[l].name}
              </span>
              {l === locale && <Check className="size-4 text-brand-600" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

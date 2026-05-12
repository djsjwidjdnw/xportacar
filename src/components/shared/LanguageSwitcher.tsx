"use client";

import { Check, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={
        <Button variant={variant} size="sm" disabled={isPending}>
          <Globe className="size-4" />
          <span className="hidden sm:inline">
            {LOCALE_NAMES[locale].flag}{" "}{LOCALE_NAMES[locale].name}
          </span>
          <span className="sm:hidden">{LOCALE_NAMES[locale].flag}</span>
        </Button>
      } />
      <DropdownMenuContent align={align} className="min-w-44">
        <DropdownMenuLabel>{t("language")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {SUPPORTED_LOCALES.map((l: Locale) => (
          <DropdownMenuItem
            key={l}
            onClick={() => l !== locale && setLocale(l)}
            className={cn(
              "flex items-center justify-between",
              l === locale && "font-semibold",
            )}
          >
            <span>
              {LOCALE_NAMES[l].flag}&nbsp;&nbsp;{LOCALE_NAMES[l].name}
            </span>
            {l === locale && <Check className="size-4 text-brand-600" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Server-side i18n helpers.  Use from Server Components / Server Actions only —
// they read `cookies()` and `headers()` from next/headers, which throws when
// imported from a Client Component bundle.
import "server-only";

import { cookies, headers } from "next/headers";

import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  type Locale,
} from "@/lib/constants";

import { createTranslator, isLocale, type TranslateValues } from "./index";

/** Read the user's locale on the server (cookie → Accept-Language → default). */
export async function resolveLocale(): Promise<Locale> {
  const c = await cookies();
  const fromCookie = c.get(LOCALE_COOKIE)?.value;
  if (isLocale(fromCookie)) return fromCookie;

  const h = await headers();
  const accept = h.get("accept-language")?.split(",") ?? [];
  for (const tag of accept) {
    const lang = tag.split(";")[0]?.trim().toLowerCase().split("-")[0];
    if (isLocale(lang)) return lang;
  }
  return DEFAULT_LOCALE;
}

export async function getTranslations(namespace?: string) {
  const locale = await resolveLocale();
  const t = createTranslator(locale);
  return function translate(key: string, values?: TranslateValues) {
    const fullKey = namespace ? `${namespace}.${key}` : key;
    return t(fullKey, values);
  };
}

export async function getLocaleFromCookie() {
  return resolveLocale();
}

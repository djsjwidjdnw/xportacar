"use client";

// React context that exposes the active locale + a translator to client
// components.  Hydrated with the messages we resolved on the server.

import { createContext, useCallback, useContext, useMemo, useState } from "react";

import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  RTL_LOCALES,
  type Locale,
} from "@/lib/constants";

import { format, lookup, type Messages, type TranslateValues } from "./index";

interface I18nContextValue {
  locale: Locale;
  messages: Messages;
  direction: "ltr" | "rtl";
  setLocale: (l: Locale) => void;
  isPending: boolean;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({
  locale,
  messages,
  children,
}: {
  locale: Locale;
  messages: Messages;
  children: React.ReactNode;
}) {
  // Use plain state, not useTransition — we want the reload to fire
  // immediately, not get deferred by React's transition scheduler.
  const [isPending, setIsPending] = useState(false);

  const setLocale = useCallback((next: Locale) => {
    if (typeof document === "undefined" || typeof window === "undefined") return;

    // 1-year cookie, root path so SSR and proxy can both see it.
    document.cookie =
      `${LOCALE_COOKIE}=${encodeURIComponent(next)}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;

    setIsPending(true);
    // Hard reload — defer one microtask so the cookie set above flushes
    // into document.cookie before navigation starts on slower browsers.
    queueMicrotask(() => {
      window.location.reload();
    });
  }, []);

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      messages,
      direction: RTL_LOCALES.includes(locale) ? "rtl" : "ltr",
      setLocale,
      isPending,
    }),
    [locale, messages, setLocale, isPending],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n / useTranslations must be used inside <I18nProvider>");
  }
  return ctx;
}

export function useLocale(): Locale {
  return useI18n().locale;
}

export function useDirection(): "ltr" | "rtl" {
  return useI18n().direction;
}

export function useSetLocale() {
  const { setLocale, isPending } = useI18n();
  return { setLocale, isPending };
}

/**
 * `useTranslations("namespace")` returns a t(key, values?) function scoped to
 * `namespace.*`, just like next-intl.  Falls back to English if a key is
 * missing in the active locale.
 */
export function useTranslations(namespace?: string) {
  const { messages } = useI18n();
  return useCallback(
    (key: string, values?: TranslateValues) => {
      const fullKey = namespace ? `${namespace}.${key}` : key;
      const template = lookup(messages, fullKey) ?? fullKey;
      return values ? format(template, values) : template;
    },
    [messages, namespace],
  );
}

export { DEFAULT_LOCALE };

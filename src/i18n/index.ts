// Lightweight i18n primitives — pure / client-safe.
// Server-only helpers (resolveLocale, getTranslations) live in ./server.ts.

import {
  DEFAULT_LOCALE,
  RTL_LOCALES,
  SUPPORTED_LOCALES,
  type Locale,
} from "@/lib/constants";

import en from "./en.json";
import de from "./de.json";
import ar from "./ar.json";
import fr from "./fr.json";

export const messages: Record<Locale, Messages> = { en, de, ar, fr };

export type Messages = typeof en;

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

export function direction(locale: Locale): "ltr" | "rtl" {
  return RTL_LOCALES.includes(locale) ? "rtl" : "ltr";
}

// --- Translator -----------------------------------------------------

export type TranslateValues = Record<string, string | number | undefined | null>;

/**
 * Look up a dotted key like "marketplace.subtitle" inside a messages tree
 * and interpolate `{name}` placeholders.  Supports a tiny subset of ICU
 * plural syntax: `{count, plural, =0 {none} =1 {one} other {# many}}`.
 */
export function lookup(messages: Messages, key: string): string | undefined {
  const parts = key.split(".");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let current: any = messages;
  for (const p of parts) {
    if (current && typeof current === "object" && p in current) {
      current = current[p];
    } else {
      return undefined;
    }
  }
  return typeof current === "string" ? current : undefined;
}

export function format(template: string, values: TranslateValues = {}): string {
  // Plural blocks first (keep it simple — count must be passed as `count`).
  let out = template.replace(
    /\{(\w+),\s*plural,\s*([^}]+(?:\{[^}]*\}[^}]*)*)\}/g,
    (_match, varName: string, body: string) => {
      const n = Number(values[varName] ?? 0);
      const cases = parsePluralCases(body);
      const exact = cases[`=${n}`];
      const chosen = exact
        ?? (n === 1 ? cases["one"] : undefined)
        ?? cases["other"]
        ?? cases[Object.keys(cases)[0] ?? ""]
        ?? "";
      return chosen.replace(/#/g, String(n));
    },
  );
  out = out.replace(/\{(\w+)\}/g, (_, name: string) => {
    const v = values[name];
    return v == null ? "" : String(v);
  });
  return out;
}

function parsePluralCases(body: string): Record<string, string> {
  const cases: Record<string, string> = {};
  const re = /(=\d+|zero|one|two|few|many|other)\s*\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(body)) !== null) {
    cases[m[1]] = m[2];
  }
  return cases;
}

export function createTranslator(locale: Locale) {
  const dict = messages[locale] ?? messages[DEFAULT_LOCALE];
  return function t(key: string, values?: TranslateValues): string {
    const template = lookup(dict, key) ?? lookup(messages[DEFAULT_LOCALE], key) ?? key;
    return values ? format(template, values) : template;
  };
}

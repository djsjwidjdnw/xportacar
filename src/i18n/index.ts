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
  // Resolve `{var, plural, …}` blocks first, then simple `{name}` placeholders.
  const out = replacePlurals(template, values);
  return out.replace(/\{(\w+)\}/g, (_, name: string) => {
    const v = values[name];
    return v == null ? "" : String(v);
  });
}

/**
 * Replace every `{var, plural, …}` block in `template`.
 *
 * Each plural case (`=0 {…}`, `one {…}`, `other {# …}`) contains its own
 * `{…}` braces, so we can't terminate the block at the first `}`.  We scan
 * forward from the `plural,` header counting brace depth until the block
 * closes — the previous regex stopped at the first `}` and left multi-case
 * plurals like `=1 {1 bid} other {# bids}` rendered verbatim.
 */
function replacePlurals(template: string, values: TranslateValues): string {
  const head = /\{(\w+),\s*plural,\s*/g;
  let result = "";
  let lastIndex = 0;
  let m: RegExpExecArray | null;

  while ((m = head.exec(template)) !== null) {
    const start = m.index;
    const bodyStart = head.lastIndex;

    // Walk forward, counting braces, until the plural block closes.
    let depth = 1;
    let i = bodyStart;
    for (; i < template.length && depth > 0; i++) {
      const ch = template[i];
      if (ch === "{") depth++;
      else if (ch === "}" && --depth === 0) break;
    }
    if (depth !== 0) break; // unbalanced — leave the remainder untouched

    const body = template.slice(bodyStart, i);
    const n = Number(values[m[1]] ?? 0);
    const cases = parsePluralCases(body);
    const chosen =
      cases[`=${n}`]
      ?? (n === 1 ? cases["one"] : undefined)
      ?? cases["other"]
      ?? cases[Object.keys(cases)[0] ?? ""]
      ?? "";

    result += template.slice(lastIndex, start) + chosen.replace(/#/g, String(n));
    lastIndex = i + 1;            // skip past the closing `}`
    head.lastIndex = lastIndex;   // resume scanning after this block
  }

  return result + template.slice(lastIndex);
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

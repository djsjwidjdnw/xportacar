"use client";

import { useTranslations } from "@/i18n/provider";

/**
 * Renders the hero headline with the last 4 words wrapped in a brand
 * gradient — done in a client component because the locale-aware text
 * needs a translator hook.
 */
export function LandingHeading() {
  const t = useTranslations("landing");
  const title = t("heroTitle");

  // Highlight the trailing clause — split on the first sentence boundary.
  const segments = title.split(/(?<=\.) /);
  const head = segments[0];
  const tail = segments.slice(1).join(" ");

  return (
    <>
      <span className="text-grey-900">{head}</span>
      {tail && (
        <>
          {" "}
          <span className="text-gradient-brand">{tail}</span>
        </>
      )}
    </>
  );
}

// Shared layout for plain-English legal pages (/privacy, /terms).
// Sections, titles and bodies come from the named i18n namespace, which
// keeps all 4 locales in lockstep. Bodies support paragraphs (separated by
// blank lines) and simple bullet lists (lines starting with "- ").
//
// IMPORTANT: this is platform documentation only. It is NOT legal advice
// and has NOT been reviewed by qualified counsel. Before going live with
// real money, both /privacy and /terms must be reviewed by a UAE lawyer
// and an EU privacy/consumer-protection lawyer.
import { getTranslations } from "@/i18n/server";

export async function LegalDocument({
  namespace,
  sectionCount,
}: {
  namespace: "privacy" | "terms";
  sectionCount: number;
}) {
  const t = await getTranslations(namespace);
  const sections = Array.from({ length: sectionCount }, (_, i) => `s${i + 1}`);

  return (
    <div className="bg-white">
      {/* Header */}
      <section className="border-b border-grey-100 bg-gradient-to-b from-brand-50 to-white">
        <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 lg:px-8 lg:py-16">
          <h1 className="text-3xl font-extrabold tracking-tight text-grey-900 sm:text-4xl">
            {t("title")}
          </h1>
          <p className="mt-3 text-sm text-grey-500">
            {t("lastUpdated")}: {t("lastUpdatedValue")} · {t("effective")}: {t("effectiveValue")}
          </p>
          <p className="mt-6 text-lg leading-relaxed text-grey-700">{t("intro")}</p>
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        {/* Translation + legal-advice notice */}
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">{t("noticeTitle")}</p>
          <p className="mt-1">{t("translationNotice")} {t("legalNotice")}</p>
        </div>

        {/* Table of contents */}
        <nav aria-label={t("tocLabel")} className="mt-10">
          <h2 className="text-xs font-bold uppercase tracking-wide text-grey-500">
            {t("tocLabel")}
          </h2>
          <ol className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            {sections.map((s, i) => (
              <li key={s}>
                <a href={`#${s}`} className="text-brand-700 hover:underline">
                  {i + 1}. {t(`${s}Title`)}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        {/* Sections */}
        <div className="mt-12 space-y-12">
          {sections.map((s, i) => (
            <section key={s} id={s} className="scroll-mt-24">
              <h2 className="text-xl font-bold text-grey-900">
                {i + 1}. {t(`${s}Title`)}
              </h2>
              <ProseBody text={t(`${s}Body`)} />
            </section>
          ))}
        </div>

        <p className="mt-14 border-t border-grey-100 pt-6 text-sm text-grey-500">
          {t("contactFooter")}
        </p>
      </div>
    </div>
  );
}

/** Renders paragraphs (split on blank lines) and bullet lists (lines starting with "- "). */
function ProseBody({ text }: { text: string }) {
  const blocks = text.split(/\n\n+/);
  return (
    <div className="mt-4 space-y-4 leading-relaxed text-grey-700">
      {blocks.map((b, i) => {
        const lines = b.split("\n").filter((l) => l.length > 0);
        const allBullets = lines.length > 0 && lines.every((l) => l.trim().startsWith("- "));
        if (allBullets) {
          return (
            <ul key={i} className="list-disc space-y-1.5 pl-6">
              {lines.map((l, j) => <li key={j}>{l.trim().replace(/^- /, "")}</li>)}
            </ul>
          );
        }
        return <p key={i}>{b}</p>;
      })}
    </div>
  );
}

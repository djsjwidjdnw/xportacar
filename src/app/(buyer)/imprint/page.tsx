import { LegalDocument } from "@/components/legal/LegalDocument";
import { getTranslations } from "@/i18n/server";

// Imprint (German "Impressum"): operator, legal form, trade licence, managing
// director, contact, person responsible for content, consumer dispute notice.
// Facts come from the signed contract and trade licence only. There is no
// phone number and no VAT ID: those lines are left out on purpose.
// Managing director: Martin Matthias Krause (contract and licence signatory).
// Add Simon here once his full name is on file.
export async function generateMetadata() {
  const t = await getTranslations("imprint");
  return { title: `${t("title")} — XportACar` };
}

export default function ImprintPage() {
  return <LegalDocument namespace="imprint" sectionCount={6} />;
}
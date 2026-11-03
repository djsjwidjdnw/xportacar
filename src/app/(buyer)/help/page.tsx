import { LegalDocument } from "@/components/legal/LegalDocument";
import { getTranslations } from "@/i18n/server";

// Help centre FAQ. Every answer is sourced from the Terms and the code:
// fixed price + Buy now (buy_now RPC, first confirmed purchase wins), KYC
// review with email + notification (profile/kyc-actions.ts), 7-day listings,
// bank transfer with 36 h confirm + 5 working days (WonInvoice), 2.9% fee
// (finalize_my_invoice), shipping options the buyer UI offers (live
// shipping_rates: warehouse, RoRo ports, door-to-door, TÜV; no container in
// the UI), invoice email with bank details + PDF, account deletion
// (delete-my-account: anonymises invoices, sends a confirmation email).
export async function generateMetadata() {
  const t = await getTranslations("help");
  return { title: `${t("title")} — XportACar` };
}

export default function HelpPage() {
  return <LegalDocument namespace="help" sectionCount={9} />;
}
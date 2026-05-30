import { LegalDocument } from "@/components/legal/LegalDocument";

// Plain-English platform terms of service.
// FLAG: NOT legal advice and NOT reviewed by qualified counsel. Before going
// live with real money, have this reviewed by a UAE lawyer (for the B2B
// terms and dispute-resolution / governing-law clauses) and an EU
// consumer-protection lawyer (for the B2C provisions, statutory warranties,
// and Distance Selling Directive 2011/83/EU compliance). The translations
// in DE/FR/AR are convenience translations only; the English version
// governs in case of discrepancy (see the in-page notice).
export const metadata = { title: "Terms of Service — XportACar" };

export default function TermsPage() {
  return <LegalDocument namespace="terms" sectionCount={20} />;
}

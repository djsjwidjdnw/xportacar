import { LegalDocument } from "@/components/legal/LegalDocument";

// Plain-English platform privacy policy.
// FLAG: NOT legal advice and NOT reviewed by qualified counsel. Before going
// live with real money, have this reviewed by a UAE lawyer and an EU
// privacy/consumer-protection lawyer. The "EU representative" required by
// GDPR Art. 27 has not yet been appointed and is referenced as TBD in §14;
// appoint one before actively marketing the service to EU consumers.
export const metadata = { title: "Privacy Policy — XportACar" };

export default function PrivacyPage() {
  return <LegalDocument namespace="privacy" sectionCount={17} />;
}

import {
  buildEmail,
  escapeHtml,
  eur,
  pickLocale,
  SITE_URL,
  type EmailContent,
  type EmailLocale,
  type Localized,
} from "./layout";

// Wire-transfer beneficiary details for the buyer's payment. The invoice PDF
// already names the beneficiary; the bank account (IBAN/SWIFT) is delivered
// here, in the email, exactly as the PDF promises ("Bank account details will
// be sent to your registered email"). These are receivables details meant to be
// shared with buyers — not secrets.
const BANK = {
  bank: "Wio Bank",
  beneficiary: "XportACar — Global Business Consultancy L.L.C-FZ",
  iban: "AE460860000006577436934",
  swift: "WIOBAEADXXX",
};

type Copy = {
  subject: (num: string) => string;
  heading: string;
  intro: (vehicleHtml: string, numHtml: string) => string;
  rowVehicle: string;
  rowFee: string;
  rowShipping: string;
  rowTotal: string;
  payHeading: string;
  payIntro: string;
  lBank: string;
  lBeneficiary: string;
  lIban: string;
  lSwift: string;
  lReference: string;
  deadline: string;
  ctaLabel: string;
};

const COPY: Localized<Copy> = {
  en: {
    subject: (num) => `Your XportACar invoice ${num}`,
    heading: "Your invoice is ready",
    intro: (veh, num) =>
      `Thank you for your purchase of <strong>${veh}</strong>. Invoice <strong>${num}</strong> is ready — the breakdown and payment instructions are below.`,
    rowVehicle: "Vehicle price",
    rowFee: "Platform fee (2.9%)",
    rowShipping: "Shipping",
    rowTotal: "Total due",
    payHeading: "How to pay",
    payIntro: "Pay by wire transfer within 5 working days of the invoice date to:",
    lBank: "Bank",
    lBeneficiary: "Beneficiary",
    lIban: "IBAN",
    lSwift: "SWIFT / BIC",
    lReference: "Reference",
    deadline: "Payment is due within 5 working days of the invoice date. Shipping begins once payment is confirmed.",
    ctaLabel: "View invoice PDF",
  },
  de: {
    subject: (num) => `Ihre XportACar-Rechnung ${num}`,
    heading: "Ihre Rechnung ist bereit",
    intro: (veh, num) =>
      `Vielen Dank für Ihren Kauf von <strong>${veh}</strong>. Rechnung <strong>${num}</strong> ist bereit — die Aufschlüsselung und Zahlungsanweisungen finden Sie unten.`,
    rowVehicle: "Fahrzeugpreis",
    rowFee: "Plattformgebühr (2,9 %)",
    rowShipping: "Versand",
    rowTotal: "Fälliger Gesamtbetrag",
    payHeading: "So bezahlen Sie",
    payIntro: "Zahlen Sie per Überweisung innerhalb von 5 Werktagen ab Rechnungsdatum an:",
    lBank: "Bank",
    lBeneficiary: "Begünstigter",
    lIban: "IBAN",
    lSwift: "SWIFT / BIC",
    lReference: "Verwendungszweck",
    deadline: "Die Zahlung ist innerhalb von 5 Werktagen ab Rechnungsdatum fällig. Der Versand beginnt nach Zahlungsbestätigung.",
    ctaLabel: "Rechnungs-PDF ansehen",
  },
  fr: {
    subject: (num) => `Votre facture XportACar ${num}`,
    heading: "Votre facture est prête",
    intro: (veh, num) =>
      `Merci pour votre achat de <strong>${veh}</strong>. La facture <strong>${num}</strong> est prête — le détail et les instructions de paiement figurent ci-dessous.`,
    rowVehicle: "Prix du véhicule",
    rowFee: "Frais de plateforme (2,9 %)",
    rowShipping: "Expédition",
    rowTotal: "Total dû",
    payHeading: "Comment payer",
    payIntro: "Payez par virement bancaire sous 5 jours ouvrés à compter de la date de facture à :",
    lBank: "Banque",
    lBeneficiary: "Bénéficiaire",
    lIban: "IBAN",
    lSwift: "SWIFT / BIC",
    lReference: "Référence",
    deadline: "Le paiement est dû sous 5 jours ouvrés à compter de la date de facture. L'expédition commence une fois le paiement confirmé.",
    ctaLabel: "Voir la facture PDF",
  },
  ar: {
    subject: (num) => `فاتورتك من XportACar ${num}`,
    heading: "فاتورتك جاهزة",
    intro: (veh, num) =>
      `شكرًا لشرائك <strong>${veh}</strong>. الفاتورة <strong>${num}</strong> جاهزة — التفاصيل وتعليمات الدفع أدناه.`,
    rowVehicle: "سعر المركبة",
    rowFee: "رسوم المنصة (2.9%)",
    rowShipping: "الشحن",
    rowTotal: "الإجمالي المستحق",
    payHeading: "كيفية الدفع",
    payIntro: "ادفع عبر التحويل البنكي خلال 5 أيام عمل من تاريخ الفاتورة إلى:",
    lBank: "البنك",
    lBeneficiary: "المستفيد",
    lIban: "الآيبان",
    lSwift: "السويفت / BIC",
    lReference: "المرجع",
    deadline: "يُستحق الدفع خلال 5 أيام عمل من تاريخ الفاتورة. يبدأ الشحن بعد تأكيد الدفع.",
    ctaLabel: "عرض الفاتورة PDF",
  },
};

function row(label: string, amountHtml: string, opts?: { bold?: boolean; align: "left" | "right" }): string {
  const w = opts?.bold ? "700" : "400";
  const color = opts?.bold ? "#101828" : "#475467";
  const start = opts?.align === "right" ? "right" : "left";
  const end = opts?.align === "right" ? "left" : "right";
  return `<tr>
    <td style="padding:8px 0;border-bottom:1px solid #eaecf0;font-size:14px;font-weight:${w};color:${color};text-align:${start};">${label}</td>
    <td style="padding:8px 0;border-bottom:1px solid #eaecf0;font-size:14px;font-weight:${w};color:${color};text-align:${end};white-space:nowrap;">${amountHtml}</td>
  </tr>`;
}

export function orderInvoiceEmail(args: {
  invoiceNumber: string;
  invoiceId: string;
  vehicleTitle: string;
  hammerEur: number;
  feeEur: number;
  shippingEur: number;
  shippingLabel?: string;
  extras?: { name: string; priceEur: number }[];
  totalEur: number;
  locale?: EmailLocale;
}): EmailContent {
  const c = pickLocale(COPY, args.locale);
  const rtl = args.locale === "ar";
  const align: "left" | "right" = rtl ? "right" : "left";
  const num = escapeHtml(args.invoiceNumber);
  const veh = escapeHtml(args.vehicleTitle);

  const extras = (args.extras ?? []).filter((e) => (Number(e.priceEur) || 0) > 0);
  const rows = [
    row(c.rowVehicle, eur(args.hammerEur), { align }),
    row(c.rowFee, eur(args.feeEur), { align }),
    ...(args.shippingEur > 0 ? [row(args.shippingLabel ? escapeHtml(args.shippingLabel) : c.rowShipping, eur(args.shippingEur), { align })] : []),
    ...extras.map((e) => row(escapeHtml(e.name), eur(e.priceEur), { align })),
    row(c.rowTotal, `<span style="color:#1570EF;">${eur(args.totalEur)}</span>`, { bold: true, align }),
  ].join("");

  const bankRow = (label: string, value: string) =>
    `<tr><td style="padding:4px 12px 4px 0;font-size:13px;color:#667085;white-space:nowrap;text-align:${align};">${label}</td><td style="padding:4px 0;font-size:13px;font-weight:600;color:#101828;text-align:${align};">${value}</td></tr>`;

  const bodyHtml = `${c.intro(veh, num)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:18px;border-collapse:collapse;">${rows}</table>
    <div style="margin-top:22px;background:#f9fafb;border:1px solid #eaecf0;border-radius:10px;padding:16px;">
      <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#101828;text-align:${align};">${c.payHeading}</p>
      <p style="margin:0 0 10px;font-size:13px;color:#475467;text-align:${align};">${c.payIntro}</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        ${bankRow(c.lBank, escapeHtml(BANK.bank))}
        ${bankRow(c.lBeneficiary, escapeHtml(BANK.beneficiary))}
        ${bankRow(c.lIban, escapeHtml(BANK.iban))}
        ${bankRow(c.lSwift, escapeHtml(BANK.swift))}
        ${bankRow(c.lReference, num)}
      </table>
    </div>
    <p style="margin:16px 0 0;font-size:12px;color:#98a2b3;text-align:${align};">${c.deadline}</p>`;

  return buildEmail({
    subject: c.subject(args.invoiceNumber),
    heading: c.heading,
    bodyHtml,
    ctaUrl: `${SITE_URL}/api/invoice/${args.invoiceId}/pdf`,
    ctaLabel: c.ctaLabel,
    dir: rtl ? "rtl" : "ltr",
  });
}

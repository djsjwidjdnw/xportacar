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

// NOTE: bank account details (IBAN / SWIFT / beneficiary / bank name) are
// INTENTIONALLY NOT in this email. The team sends the correct company wire
// details to the buyer separately. Do NOT hardcode any account here.

type Copy = {
  subject: (num: string) => string;
  heading: string;
  intro: (vehicleHtml: string, numHtml: string) => string;
  rowVehicle: string;
  rowFee: string;
  rowShipping: string;
  rowTotal: string;
  payHeading: string;
  payInfo: string;
  deadline: string;
  ctaLabel: string;
};

const COPY: Localized<Copy> = {
  en: {
    subject: (num) => `Your XportACar invoice ${num}`,
    heading: "Your invoice is ready",
    intro: (veh, num) =>
      `Thank you for your purchase of <strong>${veh}</strong>. Invoice <strong>${num}</strong> is ready — the breakdown is below.`,
    rowVehicle: "Vehicle price",
    rowFee: "Platform fee (2.9%)",
    rowShipping: "Shipping",
    rowTotal: "Total due",
    payHeading: "How to pay",
    payInfo:
      "Bank account details for payment will be sent to you separately by our team within 24 hours. If you don't receive them, please contact contact@xportacar.com.",
    deadline: "Payment is due within 5 working days of the invoice date. Shipping begins once payment is confirmed.",
    ctaLabel: "View invoice PDF",
  },
  de: {
    subject: (num) => `Ihre XportACar-Rechnung ${num}`,
    heading: "Ihre Rechnung ist bereit",
    intro: (veh, num) =>
      `Vielen Dank für Ihren Kauf von <strong>${veh}</strong>. Rechnung <strong>${num}</strong> ist bereit — die Aufschlüsselung finden Sie unten.`,
    rowVehicle: "Fahrzeugpreis",
    rowFee: "Plattformgebühr (2,9 %)",
    rowShipping: "Versand",
    rowTotal: "Fälliger Gesamtbetrag",
    payHeading: "So bezahlen Sie",
    payInfo:
      "Die Bankverbindung für die Zahlung wird Ihnen innerhalb von 24 Stunden separat von unserem Team zugesandt. Falls Sie diese nicht erhalten, kontaktieren Sie bitte contact@xportacar.com.",
    deadline: "Die Zahlung ist innerhalb von 5 Werktagen ab Rechnungsdatum fällig. Der Versand beginnt nach Zahlungsbestätigung.",
    ctaLabel: "Rechnungs-PDF ansehen",
  },
  fr: {
    subject: (num) => `Votre facture XportACar ${num}`,
    heading: "Votre facture est prête",
    intro: (veh, num) =>
      `Merci pour votre achat de <strong>${veh}</strong>. La facture <strong>${num}</strong> est prête — le détail figure ci-dessous.`,
    rowVehicle: "Prix du véhicule",
    rowFee: "Frais de plateforme (2,9 %)",
    rowShipping: "Expédition",
    rowTotal: "Total dû",
    payHeading: "Comment payer",
    payInfo:
      "Les coordonnées bancaires pour le paiement vous seront envoyées séparément par notre équipe sous 24 heures. Si vous ne les recevez pas, veuillez contacter contact@xportacar.com.",
    deadline: "Le paiement est dû sous 5 jours ouvrés à compter de la date de facture. L'expédition commence une fois le paiement confirmé.",
    ctaLabel: "Voir la facture PDF",
  },
  ar: {
    subject: (num) => `فاتورتك من XportACar ${num}`,
    heading: "فاتورتك جاهزة",
    intro: (veh, num) =>
      `شكرًا لشرائك <strong>${veh}</strong>. الفاتورة <strong>${num}</strong> جاهزة — التفاصيل أدناه.`,
    rowVehicle: "سعر المركبة",
    rowFee: "رسوم المنصة (2.9%)",
    rowShipping: "الشحن",
    rowTotal: "الإجمالي المستحق",
    payHeading: "كيفية الدفع",
    payInfo:
      "سيتم إرسال تفاصيل الحساب البنكي للدفع إليك بشكل منفصل من قِبل فريقنا خلال 24 ساعة. إذا لم تستلمها، يرجى التواصل مع contact@xportacar.com.",
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

  const bodyHtml = `${c.intro(veh, num)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:18px;border-collapse:collapse;">${rows}</table>
    <div style="margin-top:22px;background:#f9fafb;border:1px solid #eaecf0;border-radius:10px;padding:16px;">
      <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#101828;text-align:${align};">${c.payHeading}</p>
      <p style="margin:0;font-size:13px;line-height:1.6;color:#475467;text-align:${align};">${escapeHtml(c.payInfo)}</p>
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

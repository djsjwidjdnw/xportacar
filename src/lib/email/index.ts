// Public email API. Import from "@/lib/email".
//
// Each helper builds a template and hands it to the Resend transport, which
// no-ops (logging once in dev) when RESEND_API_KEY is unset and never throws.
// To start sending for real, set RESEND_API_KEY (and optionally RESEND_FROM)
// in the environment — see docs/README and .env.local.example.
//
// Every send* helper accepts an optional `locale` (any string); it is coerced
// to a supported EmailLocale ("en" fallback) before being passed to templates.

import "server-only";
import { sendEmail } from "./client";
import { toEmailLocale } from "./templates/layout";

import { welcomeEmail } from "./templates/welcome";
import { outbidEmail } from "./templates/outbid";
import { auctionWonEmail } from "./templates/auctionWon";
import { bidConfirmationEmail } from "./templates/bidConfirmation";
import { kycApprovedEmail } from "./templates/kycApproved";
import { kycRejectedEmail } from "./templates/kycRejected";
import { paymentReceivedAdminEmail } from "./templates/paymentReceivedAdmin";
import { paymentVerifiedEmail } from "./templates/paymentVerified";
import { vehicleListedEmail } from "./templates/vehicleListed";
import { newInspectorApplicationEmail } from "./templates/newInspectorApplication";
import { accountDeletedEmail } from "./templates/accountDeleted";
import { statusPickedUpEmail } from "./templates/statusPickedUp";
import { statusInTransitEmail } from "./templates/statusInTransit";
import { statusDeliveredEmail } from "./templates/statusDelivered";
import { watchlistMatchEmail } from "./templates/watchlistMatch";
import { auctionEndingSoonEmail } from "./templates/auctionEndingSoon";
import { orderInvoiceEmail } from "./templates/orderInvoice";

export type { EmailContent, EmailLocale } from "./templates/layout";
export { toEmailLocale } from "./templates/layout";
export { sendEmail } from "./client";

export { welcomeEmail } from "./templates/welcome";
export { outbidEmail } from "./templates/outbid";
export { auctionWonEmail } from "./templates/auctionWon";
export { bidConfirmationEmail } from "./templates/bidConfirmation";
export { kycApprovedEmail } from "./templates/kycApproved";
export { kycRejectedEmail } from "./templates/kycRejected";
export { paymentReceivedAdminEmail } from "./templates/paymentReceivedAdmin";
export { paymentVerifiedEmail } from "./templates/paymentVerified";
export { vehicleListedEmail } from "./templates/vehicleListed";
export { accountDeletedEmail } from "./templates/accountDeleted";
export { newInspectorApplicationEmail } from "./templates/newInspectorApplication";
export { statusPickedUpEmail } from "./templates/statusPickedUp";
export { statusInTransitEmail } from "./templates/statusInTransit";
export { statusDeliveredEmail } from "./templates/statusDelivered";
export { watchlistMatchEmail } from "./templates/watchlistMatch";
export { auctionEndingSoonEmail } from "./templates/auctionEndingSoon";
export { orderInvoiceEmail } from "./templates/orderInvoice";

export async function sendWelcomeEmail(args: { to: string; name: string; locale?: string }) {
  await sendEmail(args.to, welcomeEmail({ name: args.name, locale: toEmailLocale(args.locale) }));
}

export async function sendOutbidEmail(args: {
  to: string;
  name?: string;
  vehicleTitle: string;
  newBidEur: number;
  auctionId: string;
  locale?: string;
}) {
  await sendEmail(
    args.to,
    outbidEmail({
      vehicleTitle: args.vehicleTitle,
      newBidEur: args.newBidEur,
      auctionId: args.auctionId,
      locale: toEmailLocale(args.locale),
    }),
  );
}

export async function sendAuctionWonEmail(args: {
  to: string;
  name?: string;
  auctionId: string;
  amountEur: number;
  invoiceNumber?: string;
  locale?: string;
}) {
  await sendEmail(
    args.to,
    auctionWonEmail({
      amountEur: args.amountEur,
      auctionId: args.auctionId,
      invoiceNumber: args.invoiceNumber,
      locale: toEmailLocale(args.locale),
    }),
  );
}

export async function sendBidConfirmationEmail(args: {
  to: string;
  name?: string;
  vehicleTitle: string;
  amountEur: number;
  auctionId: string;
  locale?: string;
}) {
  await sendEmail(
    args.to,
    bidConfirmationEmail({
      vehicleTitle: args.vehicleTitle,
      amountEur: args.amountEur,
      auctionId: args.auctionId,
      locale: toEmailLocale(args.locale),
    }),
  );
}

export async function sendKycApprovedEmail(args: { to: string; name: string; locale?: string }) {
  await sendEmail(args.to, kycApprovedEmail({ name: args.name, locale: toEmailLocale(args.locale) }));
}

export async function sendKycRejectedEmail(args: {
  to: string;
  name: string;
  reason: string;
  locale?: string;
}) {
  await sendEmail(
    args.to,
    kycRejectedEmail({ name: args.name, reason: args.reason, locale: toEmailLocale(args.locale) }),
  );
}

export async function sendPaymentReceivedAdminEmail(args: {
  to: string;
  buyerName: string;
  invoiceNumber: string;
  amountEur: number;
  invoiceId: string;
  locale?: string;
}) {
  await sendEmail(
    args.to,
    paymentReceivedAdminEmail({
      buyerName: args.buyerName,
      invoiceNumber: args.invoiceNumber,
      amountEur: args.amountEur,
      invoiceId: args.invoiceId,
      locale: toEmailLocale(args.locale),
    }),
  );
}

export async function sendPaymentVerifiedEmail(args: {
  to: string;
  name: string;
  invoiceNumber: string;
  amountEur: number;
  auctionId?: string;
  locale?: string;
}) {
  await sendEmail(
    args.to,
    paymentVerifiedEmail({
      name: args.name,
      invoiceNumber: args.invoiceNumber,
      amountEur: args.amountEur,
      auctionId: args.auctionId,
      locale: toEmailLocale(args.locale),
    }),
  );
}

export async function sendVehicleListedEmail(args: {
  to: string;
  sellerName: string;
  vehicleTitle: string;
  vehicleId?: string;
  locale?: string;
}) {
  await sendEmail(
    args.to,
    vehicleListedEmail({
      sellerName: args.sellerName,
      vehicleTitle: args.vehicleTitle,
      vehicleId: args.vehicleId,
      locale: toEmailLocale(args.locale),
    }),
  );
}

export async function sendNewInspectorApplicationEmail(args: {
  to: string;
  applicantName: string;
  applicantEmail: string;
  country?: string;
  city?: string;
  experience?: string;
  locale?: string;
}) {
  await sendEmail(
    args.to,
    newInspectorApplicationEmail({
      applicantName: args.applicantName,
      applicantEmail: args.applicantEmail,
      country: args.country,
      city: args.city,
      experience: args.experience,
      locale: toEmailLocale(args.locale),
    }),
  );
}

export async function sendStatusPickedUpEmail(args: {
  to: string;
  name: string;
  vehicleTitle: string;
  note?: string;
  locale?: string;
}) {
  await sendEmail(
    args.to,
    statusPickedUpEmail({
      name: args.name,
      vehicleTitle: args.vehicleTitle,
      note: args.note,
      locale: toEmailLocale(args.locale),
    }),
  );
}

export async function sendStatusInTransitEmail(args: {
  to: string;
  name: string;
  vehicleTitle: string;
  destination?: string;
  note?: string;
  locale?: string;
}) {
  await sendEmail(
    args.to,
    statusInTransitEmail({
      name: args.name,
      vehicleTitle: args.vehicleTitle,
      destination: args.destination,
      note: args.note,
      locale: toEmailLocale(args.locale),
    }),
  );
}

export async function sendStatusDeliveredEmail(args: {
  to: string;
  name: string;
  vehicleTitle: string;
  note?: string;
  locale?: string;
}) {
  await sendEmail(
    args.to,
    statusDeliveredEmail({
      name: args.name,
      vehicleTitle: args.vehicleTitle,
      note: args.note,
      locale: toEmailLocale(args.locale),
    }),
  );
}

export async function sendWatchlistMatchEmail(args: {
  to: string;
  name: string;
  vehicleTitle: string;
  priceEur?: number;
  vehicleId: string;
  locale?: string;
}) {
  await sendEmail(
    args.to,
    watchlistMatchEmail({
      name: args.name,
      vehicleTitle: args.vehicleTitle,
      priceEur: args.priceEur,
      vehicleId: args.vehicleId,
      locale: toEmailLocale(args.locale),
    }),
  );
}

export async function sendAuctionEndingSoonEmail(args: {
  to: string;
  name: string;
  vehicleTitle: string;
  currentBidEur?: number;
  auctionId: string;
  outbid?: boolean;
  locale?: string;
}) {
  await sendEmail(
    args.to,
    auctionEndingSoonEmail({
      name: args.name,
      vehicleTitle: args.vehicleTitle,
      currentBidEur: args.currentBidEur,
      auctionId: args.auctionId,
      outbid: args.outbid,
      locale: toEmailLocale(args.locale),
    }),
  );
}

export async function sendAccountDeletedEmail(args: { to: string; dateStr: string; locale?: string }) {
  await sendEmail(args.to, accountDeletedEmail({ dateStr: args.dateStr, locale: toEmailLocale(args.locale) }));
}

export async function sendInvoiceEmail(args: {
  to: string;
  invoiceNumber: string;
  invoiceId: string;
  vehicleTitle: string;
  hammerEur: number;
  feeEur: number;
  shippingEur: number;
  shippingLabel?: string;
  extras?: { name: string; priceEur: number }[];
  totalEur: number;
  locale?: string;
  /** Optional PDF (or other) attachments — e.g. the rendered invoice PDF. */
  attachments?: { filename: string; content: Buffer; contentType?: string }[];
}) {
  await sendEmail(
    args.to,
    orderInvoiceEmail({
      invoiceNumber: args.invoiceNumber,
      invoiceId: args.invoiceId,
      vehicleTitle: args.vehicleTitle,
      hammerEur: args.hammerEur,
      feeEur: args.feeEur,
      shippingEur: args.shippingEur,
      shippingLabel: args.shippingLabel,
      extras: args.extras,
      totalEur: args.totalEur,
      locale: toEmailLocale(args.locale),
    }),
    args.attachments,
  );
}

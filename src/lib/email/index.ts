// Public email API. Import from "@/lib/email".
//
// Each helper builds a template and hands it to the Resend transport, which
// no-ops (logging once in dev) when RESEND_API_KEY is unset and never throws.
// To start sending for real, set RESEND_API_KEY (and optionally RESEND_FROM)
// in the environment — see docs/README and .env.local.example.

import "server-only";
import { sendEmail } from "./client";

import { welcomeEmail } from "./templates/welcome";
import { outbidEmail } from "./templates/outbid";
import { auctionWonEmail } from "./templates/auctionWon";
import { bidConfirmationEmail } from "./templates/bidConfirmation";
import { kycApprovedEmail } from "./templates/kycApproved";
import { kycRejectedEmail } from "./templates/kycRejected";
import { paymentReceivedAdminEmail } from "./templates/paymentReceivedAdmin";
import { paymentVerifiedEmail } from "./templates/paymentVerified";
import { vehicleListedEmail } from "./templates/vehicleListed";

export type { EmailContent } from "./templates/layout";
export { sendEmail } from "./client";

export async function sendWelcomeEmail(args: { to: string; name: string }) {
  await sendEmail(args.to, welcomeEmail({ name: args.name }));
}

export async function sendOutbidEmail(args: {
  to: string;
  name?: string;
  vehicleTitle: string;
  newBidEur: number;
  auctionId: string;
}) {
  await sendEmail(
    args.to,
    outbidEmail({ vehicleTitle: args.vehicleTitle, newBidEur: args.newBidEur, auctionId: args.auctionId }),
  );
}

export async function sendAuctionWonEmail(args: {
  to: string;
  name?: string;
  auctionId: string;
  amountEur: number;
  invoiceNumber?: string;
}) {
  await sendEmail(
    args.to,
    auctionWonEmail({ amountEur: args.amountEur, auctionId: args.auctionId, invoiceNumber: args.invoiceNumber }),
  );
}

export async function sendBidConfirmationEmail(args: {
  to: string;
  name?: string;
  vehicleTitle: string;
  amountEur: number;
  auctionId: string;
}) {
  await sendEmail(
    args.to,
    bidConfirmationEmail({ vehicleTitle: args.vehicleTitle, amountEur: args.amountEur, auctionId: args.auctionId }),
  );
}

export async function sendKycApprovedEmail(args: { to: string; name: string }) {
  await sendEmail(args.to, kycApprovedEmail({ name: args.name }));
}

export async function sendKycRejectedEmail(args: { to: string; name: string; reason: string }) {
  await sendEmail(args.to, kycRejectedEmail({ name: args.name, reason: args.reason }));
}

export async function sendPaymentReceivedAdminEmail(args: {
  to: string;
  buyerName: string;
  invoiceNumber: string;
  amountEur: number;
  invoiceId: string;
}) {
  await sendEmail(
    args.to,
    paymentReceivedAdminEmail({
      buyerName: args.buyerName,
      invoiceNumber: args.invoiceNumber,
      amountEur: args.amountEur,
      invoiceId: args.invoiceId,
    }),
  );
}

export async function sendPaymentVerifiedEmail(args: {
  to: string;
  name: string;
  invoiceNumber: string;
  amountEur: number;
  auctionId?: string;
}) {
  await sendEmail(
    args.to,
    paymentVerifiedEmail({
      name: args.name,
      invoiceNumber: args.invoiceNumber,
      amountEur: args.amountEur,
      auctionId: args.auctionId,
    }),
  );
}

export async function sendVehicleListedEmail(args: {
  to: string;
  sellerName: string;
  vehicleTitle: string;
  vehicleId?: string;
}) {
  await sendEmail(
    args.to,
    vehicleListedEmail({ sellerName: args.sellerName, vehicleTitle: args.vehicleTitle, vehicleId: args.vehicleId }),
  );
}

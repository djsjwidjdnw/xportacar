// Minimal Resend wrapper.  Skips silently if RESEND_API_KEY is not set
// — every helper returns void on no-op, never throws, so the calling
// server action keeps working in environments without email configured.

import "server-only";

const RESEND_API = "https://api.resend.com/emails";
const FROM = process.env.RESEND_FROM ?? "XportACar <noreply@xportacar.com>";
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

async function sendEmail(payload: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return;                       // silently skip in dev
  try {
    await fetch(RESEND_API, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM,
        to: [payload.to],
        subject: payload.subject,
        html: payload.html,
      }),
    });
  } catch {
    // Network blip — don't fail the host action.
  }
}

function shell(title: string, body: string, ctaUrl?: string, ctaLabel?: string) {
  return `<!doctype html>
  <html><body style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#f9fafb;padding:24px;">
    <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #eaecf0;overflow:hidden;">
      <div style="background:#1570EF;color:#fff;padding:24px;">
        <h1 style="margin:0;font-size:20px;font-weight:800;">XportACar</h1>
      </div>
      <div style="padding:24px;color:#101828;">
        <h2 style="margin:0 0 16px;font-size:18px;">${title}</h2>
        <div style="font-size:14px;line-height:1.6;color:#475467;">${body}</div>
        ${ctaUrl
          ? `<div style="margin-top:24px;"><a href="${ctaUrl}" style="display:inline-block;background:#1570EF;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600;">${ctaLabel ?? "Open XportACar"}</a></div>`
          : ""}
      </div>
      <div style="border-top:1px solid #eaecf0;padding:16px 24px;font-size:11px;color:#98a2b3;">
        © XportACar — UAE-to-EU vehicle auctions
      </div>
    </div>
  </body></html>`;
}

export async function sendWelcomeEmail(args: { to: string; name: string }) {
  await sendEmail({
    to: args.to,
    subject: "Welcome to XportACar",
    html: shell(
      `Welcome ${args.name || "to XportACar"}`,
      `Your trade account is live.  Browse the marketplace to start bidding on UAE-sourced vehicles.`,
      `${SITE}/marketplace`,
      "Browse marketplace",
    ),
  });
}

export async function sendOutbidEmail(args: {
  to: string;
  name: string;
  vehicleTitle: string;
  newBidEur: number;
  auctionId: string;
}) {
  await sendEmail({
    to: args.to,
    subject: `You've been outbid on ${args.vehicleTitle}`,
    html: shell(
      `You've been outbid`,
      `The current top bid on <strong>${args.vehicleTitle}</strong> is now <strong>€${args.newBidEur.toLocaleString("en-GB")}</strong>. Place a counter-bid to stay in the auction.`,
      `${SITE}/auction/${args.auctionId}`,
      "Place counter-bid",
    ),
  });
}

export async function sendAuctionWonEmail(args: {
  to: string;
  name: string;
  auctionId: string;
  amountEur: number;
}) {
  await sendEmail({
    to: args.to,
    subject: "You won the auction!",
    html: shell(
      `You won the auction`,
      `Congratulations — your winning bid of <strong>€${args.amountEur.toLocaleString("en-GB")}</strong> has been recorded. Our team will be in touch about payment and shipping.`,
      `${SITE}/auction/${args.auctionId}/won`,
      "View confirmation",
    ),
  });
}

export async function sendBidConfirmationEmail(args: {
  to: string;
  name: string;
  vehicleTitle: string;
  amountEur: number;
  auctionId: string;
}) {
  await sendEmail({
    to: args.to,
    subject: `Bid placed: €${args.amountEur.toLocaleString("en-GB")} on ${args.vehicleTitle}`,
    html: shell(
      `Bid confirmed`,
      `We've recorded your bid of <strong>€${args.amountEur.toLocaleString("en-GB")}</strong> on <strong>${args.vehicleTitle}</strong>.`,
      `${SITE}/auction/${args.auctionId}`,
      "Open auction",
    ),
  });
}

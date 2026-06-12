// POST /api/internal/notify — internal endpoint the email-automation cron Edge
// Functions call to send a BRANDED, LOCALIZED email via the shared email module
// (Edge Functions run in Deno and can't import the Next "server-only" email
// code, so they delegate the actual send here). Protected by the shared
// CRON_SECRET header. Best-effort; never throws to the caller.

import { NextResponse } from "next/server";
import { sendWatchlistMatchEmail, sendAuctionEndingSoonEmail, sendAuctionWonEmail } from "@/lib/email";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET ?? "";
  if (!secret || req.headers.get("x-cron-secret") !== secret) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: {
    kind?: string;
    to?: string;
    locale?: string;
    name?: string;
    vehicleTitle?: string;
    vehicleId?: string;
    auctionId?: string;
    priceEur?: number;
    currentBidEur?: number;
    amountEur?: number;
    invoiceNumber?: string;
    outbid?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }

  const { kind, to } = body;
  if (!to || !kind) return NextResponse.json({ ok: false, error: "missing fields" }, { status: 400 });

  try {
    if (kind === "watchlist_match") {
      await sendWatchlistMatchEmail({
        to,
        name: body.name ?? "",
        vehicleTitle: body.vehicleTitle ?? "",
        vehicleId: body.vehicleId ?? "",
        priceEur: body.priceEur,
        locale: body.locale,
      });
    } else if (kind === "auction_ending") {
      await sendAuctionEndingSoonEmail({
        to,
        name: body.name ?? "",
        vehicleTitle: body.vehicleTitle ?? "",
        auctionId: body.auctionId ?? "",
        currentBidEur: body.currentBidEur,
        outbid: body.outbid,
        locale: body.locale,
      });
    } else if (kind === "auction_won") {
      await sendAuctionWonEmail({
        to,
        name: body.name ?? "",
        auctionId: body.auctionId ?? "",
        amountEur: body.amountEur ?? 0,
        invoiceNumber: body.invoiceNumber,
        locale: body.locale,
      });
    } else {
      return NextResponse.json({ ok: false, error: "unknown kind" }, { status: 400 });
    }
  } catch {
    // Email is best-effort — don't fail the cron caller.
    return NextResponse.json({ ok: true, sent: false });
  }

  return NextResponse.json({ ok: true, sent: true });
}

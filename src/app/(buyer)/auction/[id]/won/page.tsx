import { after } from "next/server";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CheckCircle2, ArrowRight, Trophy } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { PayNowButton } from "@/components/buyer/PayNowButton";
import { WonInvoice } from "@/components/buyer/WonInvoice";
import {
  StatusTimeline,
  TIMELINE_STEPS,
  type StatusEvent,
  type TimelineStatus,
} from "@/components/buyer/StatusTimeline";
import { createClient } from "@/lib/supabase/server";
import { settleEndedAuctions } from "@/lib/auctions";
import { isStripeConfigured } from "@/lib/stripe";
import { getTranslations } from "@/i18n/server";
import { auctionPhase, cn } from "@/lib/utils";

export const metadata = { title: "Auction won" };

export default async function AuctionWonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const t = await getTranslations("timeline");

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/auction/${id}/won`);

  const { data: auctionRow, error } = await supabase
    .from("auctions")
    .select(`
      id, status, winner_id, start_time, end_time, current_bid_eur, buy_now_price_eur,
      vehicle:vehicles!vehicle_id ( id, year, make, model, vin, status, sold_at, location_city, location_country )
    `)
    .eq("id", id)
    .single();

  if (error || !auctionRow) notFound();

  // deno-lint-ignore no-explicit-any
  const a = auctionRow as any;
  const v = a.vehicle;
  const phase = auctionPhase(a);

  // Resolve the top bidder so a naturally-ended auction whose winner_id hasn't
  // been written yet still recognises its winner.
  const { data: top } = await supabase
    .from("bids")
    .select("bidder_id, amount_eur")
    .eq("auction_id", a.id)
    .order("amount_eur", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const topBidderId = (top?.bidder_id as string | undefined) ?? null;
  const topAmount = top?.amount_eur != null ? Number(top.amount_eur) : null;

  const isWinner =
    a.winner_id === user.id ||
    (phase === "ended" && topBidderId != null && topBidderId === user.id);
  const hammerEur = (a.current_bid_eur ?? a.buy_now_price_eur ?? topAmount ?? 0) as number;

  // Make the win durable for the dashboard / future loads.
  if (phase === "ended" && a.status === "active") {
    after(() => settleEndedAuctions([a.id]));
  }

  // Pull the auto-generated invoice (if any) so we can offer confirm / Pay Now.
  let invoice: {
    id: string; status: string; invoice_number: string | null;
    created_at: string; payment_confirmed_at: string | null;
  } | null = null;
  if (isWinner) {
    const { data: inv } = await supabase
      .from("invoices")
      .select("id, status, invoice_number, created_at, payment_confirmed_at")
      .eq("auction_id", a.id)
      .eq("buyer_id", user.id)
      .maybeSingle();
    // deno-lint-ignore no-explicit-any
    invoice = (inv as any) ?? null;
  }
  const invoiceId = invoice && invoice.status !== "paid" ? invoice.id : null;

  // Order-lifecycle timeline (sold → picked_up → in_transit → delivered).
  let statusEvents: StatusEvent[] = [];
  if (isWinner && v) {
    const { data: ev } = await supabase
      .from("vehicle_status_events")
      .select("status, note, created_at")
      .eq("vehicle_id", v.id)
      .in("status", TIMELINE_STEPS as unknown as string[])
      .order("created_at", { ascending: true });
    statusEvents = (ev as StatusEvent[] | null) ?? [];
  }
  const timelineLabels: Record<TimelineStatus, string> = {
    sold: t("sold"),
    picked_up: t("pickedUp"),
    in_transit: t("inTransit"),
    delivered: t("delivered"),
  };

  return (
    <div className="bg-grey-50 py-12 sm:py-16">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Celebration banner */}
        <div className="rounded-3xl border border-success-200 bg-gradient-to-br from-success-600 to-success-700 p-8 text-center text-white shadow-lg sm:p-10">
          <div className="mx-auto grid size-16 place-items-center rounded-full bg-white/15 ring-2 ring-white/25">
            <Trophy className="size-9 text-white" />
          </div>
          <h1 className="mt-5 text-3xl font-extrabold tracking-tight sm:text-4xl">
            {isWinner ? "Congratulations! You won this auction" : "Auction closed"}
          </h1>
          {v && (
            <p className="mt-2 text-base font-semibold text-white/95">
              {v.year} {v.make} {v.model}
            </p>
          )}
          {isWinner && (
            <p className="mt-2 text-sm text-white/90">
              Confirm your payment within 36 hours to secure this vehicle.
            </p>
          )}
        </div>

        {isWinner && v && (
          <StatusTimeline
            title={t("orderStatus")}
            labels={timelineLabels}
            currentStatus={v.status ?? null}
            soldAtIso={v.sold_at ?? null}
            events={statusEvents}
          />
        )}

        {isWinner && v && (
          <WonInvoice
            vehicle={{
              year: v.year,
              make: v.make,
              model: v.model,
              vin: v.vin ?? "",
              city: v.location_city,
              country: v.location_country,
            }}
            hammerEur={hammerEur}
            userEmail={user.email ?? null}
            invoiceId={invoice?.id ?? null}
            invoiceNumber={invoice?.invoice_number ?? null}
            createdAtIso={invoice?.created_at ?? null}
            confirmedAtIso={invoice?.payment_confirmed_at ?? null}
          />
        )}

        {!isWinner && (
          <div className="rounded-2xl border border-grey-200 bg-white p-8 text-center shadow-sm">
            <CheckCircle2 className="mx-auto size-8 text-grey-400" />
            <p className="mt-3 text-grey-600">
              This auction has ended. Thanks for participating — keep an eye on the marketplace for similar vehicles.
            </p>
          </div>
        )}

        {isWinner && invoiceId && (
          <div className="rounded-2xl border border-brand-100 bg-brand-50/60 p-5">
            <PayNowButton invoiceId={invoiceId} stripeConfigured={isStripeConfigured()} />
          </div>
        )}

        <div className="flex flex-wrap justify-center gap-3 pt-2">
          <Link
            href={`/auction/${id}`}
            className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-11 px-5")}
          >
            View auction page
          </Link>
          <Link
            href="/dashboard"
            className={cn(buttonVariants({ variant: "default", size: "lg" }), "h-11 px-5")}
          >
            View dashboard
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}

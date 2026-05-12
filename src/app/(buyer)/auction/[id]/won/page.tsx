import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CheckCircle2, ArrowRight, Truck } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { getTranslations } from "@/i18n/server";
import { cn, formatEur } from "@/lib/utils";

export const metadata = { title: "Auction won" };

export default async function AuctionWonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const t = await getTranslations();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/auction/${id}/won`);

  const { data: auctionRow, error } = await supabase
    .from("auctions")
    .select(`
      id, status, winner_id, current_bid_eur, buy_now_price_eur,
      vehicle:vehicles!vehicle_id ( id, year, make, model, location_city, location_country )
    `)
    .eq("id", id)
    .single();

  if (error || !auctionRow) notFound();

  // deno-lint-ignore no-explicit-any
  const a = auctionRow as any;
  const isWinner = a.winner_id === user.id;
  const v = a.vehicle;
  const amount = a.current_bid_eur ?? a.buy_now_price_eur;

  return (
    <div className="bg-grey-50 py-16">
      <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-success-200 bg-white p-10 text-center shadow-lg">
          <div className="mx-auto grid size-16 place-items-center rounded-full bg-success-50 ring-1 ring-success-100">
            <CheckCircle2 className="size-9 text-success-600" />
          </div>

          <h1 className="mt-6 text-3xl font-extrabold tracking-tight text-grey-900 sm:text-4xl">
            {isWinner ? t("auction.wonTitle") : "Auction closed"}
          </h1>
          <p className="mx-auto mt-3 max-w-md text-grey-600">
            {isWinner
              ? t("auction.wonSubtitle")
              : "This auction has ended. Thanks for participating — keep an eye on the marketplace for similar vehicles."}
          </p>

          {v && (
            <div className="mx-auto mt-8 max-w-md rounded-2xl border border-grey-200 bg-grey-50 p-5 text-left">
              <p className="text-xs font-semibold uppercase tracking-wide text-grey-500">
                Vehicle
              </p>
              <p className="mt-1 text-lg font-bold text-grey-900">
                {v.year} {v.make} {v.model}
              </p>
              <p className="text-sm text-grey-500">
                {v.location_city}, {v.location_country}
              </p>
              <div className="mt-4 flex items-baseline justify-between border-t border-grey-200 pt-4">
                <span className="text-xs font-semibold uppercase tracking-wide text-grey-500">
                  {t("auction.wonAmount")}
                </span>
                <span className="text-2xl font-extrabold tabular-nums text-grey-900">
                  {formatEur(amount)}
                </span>
              </div>
            </div>
          )}

          {isWinner && (
            <div className="mx-auto mt-6 flex max-w-md items-start gap-3 rounded-xl border border-brand-100 bg-brand-50 p-4 text-left text-sm">
              <Truck className="mt-0.5 size-5 shrink-0 text-brand-600" />
              <p className="text-brand-800">
                Our UAE collection team will email you within 24 hours with the
                payment instructions and a shipping quote to your address.
              </p>
            </div>
          )}

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href={`/auction/${id}`}
              className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-11 px-5")}
            >
              {t("auction.wonAuctionLink")}
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
    </div>
  );
}

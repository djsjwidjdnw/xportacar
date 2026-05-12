"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Minus, Plus, Gavel, ShoppingCart } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader,
  DialogTitle, DialogTrigger, DialogClose,
} from "@/components/ui/dialog";
import { AuctionCountdown } from "./AuctionCountdown";
import { toast } from "@/components/ui/toast";

import { bidIncrement } from "@/lib/constants";
import { useTranslations } from "@/i18n/provider";
import { useAuction } from "@/hooks/useAuction";
import { cn, formatEur, formatRelativeTime, initials } from "@/lib/utils";
import {
  placeBidAction,
  buyNowAction,
} from "@/app/(buyer)/auction/actions";
import type { Auction, BidWithBidder } from "@/types";

export function BidPanel({
  auction: initialAuction,
  bids: initialBids,
  buyNowPriceEur,
  isAuthenticated,
  currentUserId,
  vehicleTitle,
}: {
  auction: Auction;
  bids: BidWithBidder[];
  buyNowPriceEur: number | null;
  isAuthenticated: boolean;
  currentUserId: string | null;
  vehicleTitle: string;
}) {
  const t = useTranslations();
  const router = useRouter();
  const { auction, bids } = useAuction({ initialAuction, initialBids });

  const currentBid = auction.current_bid_eur ?? auction.starting_price_eur;
  const minNext = currentBid + bidIncrement(currentBid);

  const [amount, setAmount] = useState<number>(minNext);
  const [submitting, setSubmitting] = useState(false);
  const [buying, setBuying] = useState(false);
  const [buyOpen, setBuyOpen] = useState(false);

  // Whenever the live current_bid jumps, ensure our input is still legal.
  useEffect(() => {
    setAmount((a) => (a < minNext ? minNext : a));
  }, [minNext]);

  const isWinning = useMemo(
    () => currentUserId != null && bids[0]?.bidder_id === currentUserId,
    [bids, currentUserId],
  );
  const userHasBid = useMemo(
    () => currentUserId != null && bids.some((b) => b.bidder_id === currentUserId),
    [bids, currentUserId],
  );

  const auctionEnded = useMemo(
    () => auction.status !== "active" || new Date(auction.end_time).getTime() <= Date.now(),
    [auction.status, auction.end_time],
  );

  const placeBid = async () => {
    if (!isAuthenticated) {
      toast.err("Sign in required", "Sign in to place a bid.");
      return;
    }
    if (amount < minNext) {
      toast.err("Bid too low", `Minimum next bid is ${formatEur(minNext)}.`);
      return;
    }
    setSubmitting(true);
    const res = await placeBidAction({ auctionId: auction.id, amountEur: amount });
    setSubmitting(false);
    if (!res.ok) {
      toast.err(t("auction.bidFailed", { error: res.error ?? "Unknown error" }));
      return;
    }
    toast.ok(t("auction.bidPlaced"), `${formatEur(amount)} on ${vehicleTitle}`);
  };

  const buyNow = async () => {
    setBuying(true);
    const res = await buyNowAction({ auctionId: auction.id });
    setBuying(false);
    setBuyOpen(false);
    if (!res.ok) {
      toast.err("Purchase failed", res.error);
      return;
    }
    toast.ok("You won!", `Redirecting to confirmation…`);
    router.push(`/auction/${auction.id}/won`);
  };

  const adjust = (delta: 1 | -1) => {
    setAmount((a) => Math.max(minNext, a + delta * bidIncrement(a)));
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-grey-200 bg-white p-6 shadow-md">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-grey-500">
              {t("auction.currentBid")}
            </p>
            <p className="mt-1 text-3xl font-extrabold text-grey-900 sm:text-4xl tabular-nums">
              {formatEur(currentBid)}
            </p>
          </div>
          {userHasBid && (
            <Badge className={cn(
              "ring-1",
              isWinning
                ? "bg-success-50 text-success-700 ring-success-100"
                : "bg-warning-50 text-warning-700 ring-warning-100",
            )}>
              {isWinning ? t("auction.winning") : t("auction.outbid")}
            </Badge>
          )}
        </div>

        <div className="mt-2 flex items-center gap-3 text-sm text-grey-500">
          <span>{t("auction.bidCount", { count: auction.bid_count })}</span>
          <span aria-hidden>·</span>
          <span>{t("auction.bidderCount", { count: auction.bidder_count })}</span>
        </div>

        <div className="mt-6">
          <AuctionCountdown endTime={auction.end_time} />
        </div>

        {/* ----- Bid input ----- */}
        <div className="mt-6 border-t border-grey-100 pt-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-grey-500">
            {t("auction.yourBid")}
          </p>
          <p className="mt-1 text-xs text-grey-500">
            {t("auction.minBid", { price: formatEur(minNext) })}
          </p>
          <div className="mt-3 flex gap-2">
            <Button variant="outline" size="icon-lg" aria-label="Decrease" onClick={() => adjust(-1)} disabled={!isAuthenticated || submitting || auctionEnded}>
              <Minus className="size-4" />
            </Button>
            <div className="relative flex-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-grey-400">€</span>
              <Input
                type="number"
                inputMode="numeric"
                value={amount}
                min={minNext}
                step={bidIncrement(currentBid)}
                onChange={(e) => setAmount(Math.max(0, Number(e.currentTarget.value || 0)))}
                disabled={!isAuthenticated || submitting || auctionEnded}
                className="h-11 pl-7 text-base tabular-nums"
              />
            </div>
            <Button variant="outline" size="icon-lg" aria-label="Increase" onClick={() => adjust(1)} disabled={!isAuthenticated || submitting || auctionEnded}>
              <Plus className="size-4" />
            </Button>
          </div>

          {auctionEnded ? (
            <Button disabled size="lg" className="mt-3 h-12 w-full text-base">
              Auction ended
            </Button>
          ) : !isAuthenticated ? (
            <Link
              href={`/login?next=/auction/${auction.id}`}
              className={cn(buttonVariants({ variant: "default", size: "lg" }), "mt-3 h-12 w-full text-base")}
            >
              {t("auction.signInToBid")}
            </Link>
          ) : (
            <Button
              onClick={placeBid}
              disabled={submitting || amount < minNext}
              size="lg"
              className="mt-3 h-12 w-full text-base"
            >
              <Gavel className="size-4" />
              {submitting ? t("common.loading") : t("auction.placeBid")}
            </Button>
          )}

          {buyNowPriceEur != null && isAuthenticated && !auctionEnded && (
            <Dialog open={buyOpen} onOpenChange={setBuyOpen}>
              <DialogTrigger render={
                <Button variant="outline" size="lg" className="mt-2 h-12 w-full text-base">
                  <ShoppingCart className="size-4" />
                  {t("auction.buyNowFor", { price: formatEur(buyNowPriceEur) })}
                </Button>
              } />
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>End the auction with Buy Now?</DialogTitle>
                  <DialogDescription>
                    You are about to purchase <span className="font-semibold text-grey-900">{vehicleTitle}</span> for{" "}
                    <span className="font-semibold text-grey-900">{formatEur(buyNowPriceEur)}</span>.
                    This closes the auction immediately — other bidders will not be able to outbid you.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose render={
                    <Button variant="outline" disabled={buying}>{t("common.cancel")}</Button>
                  } />
                  <Button onClick={buyNow} disabled={buying}>
                    {buying ? t("common.loading") : t("auction.confirmBuyNow")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* ----- Bid history ----- */}
      <div className="rounded-2xl border border-grey-200 bg-white shadow-xs">
        <div className="border-b border-grey-100 px-5 py-3">
          <h3 className="text-sm font-bold text-grey-900">
            {t("auction.history")}
          </h3>
        </div>
        {bids.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-grey-500">
            {t("common.noBids")} — {vehicleTitle}
          </p>
        ) : (
          <ul className="max-h-96 overflow-y-auto scrollbar-thin">
            {bids.map((b, i) => (
              <li
                key={b.id}
                className={cn(
                  "flex items-center justify-between gap-3 px-5 py-3 text-sm",
                  i !== bids.length - 1 && "border-b border-grey-100",
                  i === 0 && "bg-success-50/40",
                )}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar className="size-7">
                    <AvatarImage src={b.bidder?.avatar_url ?? undefined} />
                    <AvatarFallback className="bg-brand-100 text-[11px] font-semibold text-brand-700">
                      {initials(b.bidder?.full_name ?? b.bidder?.company_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-grey-900">
                      {b.bidder?.company_name ?? b.bidder?.full_name ?? "Bidder"}
                    </p>
                    <p className="truncate text-[11px] text-grey-500">
                      {b.bidder?.country} · {formatRelativeTime(b.created_at)}
                    </p>
                  </div>
                </div>
                <p className="shrink-0 text-sm font-bold tabular-nums text-grey-900">
                  {formatEur(b.amount_eur)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

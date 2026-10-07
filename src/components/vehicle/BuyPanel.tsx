"use client";

// Right-rail purchase card on the vehicle page in the fixed-price marketplace
// (app_settings.bidding_enabled off). One price, the days left on the 7-day
// listing, and a KYC-gated Buy button that runs the buy_now() RPC through
// buyNowAction, then sends the buyer to their order page.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, CalendarClock, CheckCircle2, ShieldAlert, ShoppingCart } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader,
  DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { CurrencyPills } from "@/components/buyer/CurrencyPills";
import { useTranslations } from "@/i18n/provider";
import { useCurrency } from "@/lib/currency";
import { daysLeftLabel, listingState } from "@/lib/listing";
import { cn } from "@/lib/utils";
import { buyNowAction } from "@/app/(buyer)/auction/actions";
import type { KycStatus } from "@/types";

export function BuyPanel({
  vehicleId,
  vehicleTitle,
  listing,
  priceEur,
  isAuthenticated,
  currentUserId,
  kycStatus,
  locationCity,
  locationCountry,
}: {
  vehicleId: string;
  vehicleTitle: string;
  listing: {
    id: string;
    status: string;
    start_time?: string | null;
    end_time?: string | null;
    winner_id?: string | null;
  } | null;
  priceEur: number | null;
  isAuthenticated: boolean;
  currentUserId: string | null;
  kycStatus: KycStatus | null;
  locationCity: string;
  locationCountry: string;
}) {
  const t = useTranslations();
  const router = useRouter();
  const { format } = useCurrency();
  const [open, setOpen] = useState(false);
  const [buying, setBuying] = useState(false);

  // Minute tick: flips the panel to "ended" when the 7 days run out while open.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const state = listingState(listing, now);
  const boughtByMe = state === "sold" && !!currentUserId && listing?.winner_id === currentUserId;
  const verified = kycStatus === "verified";

  const buy = async () => {
    if (!listing) return;
    setBuying(true);
    const res = await buyNowAction({ auctionId: listing.id });
    setBuying(false);
    if (!res.ok) {
      setOpen(false);
      const msg =
        res.code === "KYC" ? (kycStatus === "rejected" ? t("kyc.bidLockedRejectedBody") : t("kyc.bidLockedPendingBody"))
        : res.code === "AUTH" ? t("listing.errSignIn")
        : res.code === "UNAVAILABLE" ? t("listing.errUnavailable")
        : t("listing.errGeneric");
      toast.err(t("listing.purchaseFailed"), msg);
      router.refresh();
      return;
    }
    toast.ok(t("listing.purchaseDone"), t("listing.redirecting"));
    router.push(`/auction/${listing.id}/won`);
  };

  return (
    <div className="rounded-2xl border border-grey-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-grey-500">{t("listing.price")}</p>
        <CurrencyPills />
      </div>
      <p className="mt-1 text-3xl font-extrabold text-grey-900 tabular-nums">{format(priceEur ?? 0)}</p>

      {state === "live" && (
        <>
          <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-grey-700">
            <CalendarClock className="size-4 text-brand-600" />
            {daysLeftLabel(t, listing?.end_time, now)}
          </p>
          <p className="mt-1 text-xs text-grey-500">{t("listing.feeNote")}</p>
        </>
      )}

      <div className="mt-5 flex flex-col gap-2">
        {state === "live" && !isAuthenticated && (
          <Link
            href={`/login?next=/vehicle/${vehicleId}`}
            className={cn(buttonVariants({ variant: "default", size: "lg" }), "h-12 w-full justify-center text-base font-bold")}
          >
            {t("listing.signInToBuy")}
          </Link>
        )}

        {state === "live" && isAuthenticated && !verified && (
          <div className="rounded-xl border border-warning-200 bg-warning-50 p-4 text-center">
            <ShieldAlert className="mx-auto size-6 text-warning-600" />
            <p className="mt-2 text-sm font-bold text-grey-900">
              {kycStatus === "rejected" ? t("kyc.rejectedTitle") : t("kyc.bidLockedPendingTitle")}
            </p>
            <p className="mt-1 text-xs text-grey-600">
              {kycStatus === "rejected" ? t("kyc.bidLockedRejectedBody") : t("kyc.bidLockedPendingBody")}
            </p>
            <Link
              href="/pending-verification"
              className={cn(buttonVariants({ variant: "default", size: "lg" }), "mt-4 h-11 w-full text-base")}
            >
              {t("kyc.bidLockedCta")}
            </Link>
          </div>
        )}

        {state === "live" && isAuthenticated && verified && listing && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={
              <Button size="lg" className="h-12 w-full text-base font-bold">
                <ShoppingCart className="size-4" />
                {t("listing.buyNow")}
              </Button>
            } />
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{t("listing.confirmTitle")}</DialogTitle>
                <DialogDescription>
                  {t("listing.confirmBody", { vehicle: vehicleTitle, price: format(priceEur ?? 0) })}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose render={<Button variant="outline" disabled={buying}>{t("common.cancel")}</Button>} />
                <Button onClick={buy} disabled={buying}>
                  {buying ? t("common.loading") : t("listing.confirmCta")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {boughtByMe && listing && (
          <div className="rounded-xl border border-success-200 bg-success-50 p-4 text-center">
            <CheckCircle2 className="mx-auto size-6 text-success-600" />
            <p className="mt-2 text-sm font-bold text-grey-900">{t("listing.youBoughtThis")}</p>
            <Link
              href={`/auction/${listing.id}/won`}
              className={cn(buttonVariants({ variant: "default", size: "lg" }), "mt-4 h-11 w-full text-base")}
            >
              {t("listing.viewOrder")}
              <ArrowRight className="size-4" />
            </Link>
          </div>
        )}

        {state !== "live" && !boughtByMe && (
          <div className="rounded-xl border border-grey-200 bg-grey-50 p-4 text-center">
            <p className="text-sm font-bold text-grey-900">
              {state === "sold" ? t("listing.sold") : state === "expired" ? t("listing.expired") : t("listing.notListed")}
            </p>
            <p className="mt-1 text-xs text-grey-600">
              {state === "sold" ? t("listing.soldBody") : state === "expired" ? t("listing.expiredBody") : t("listing.notListedBody")}
            </p>
            <Link
              href="/marketplace"
              className={cn(buttonVariants({ variant: "outline", size: "lg" }), "mt-4 h-11 w-full text-base")}
            >
              {t("listing.backToMarketplace")}
            </Link>
          </div>
        )}
      </div>

      <dl className="mt-6 space-y-2.5 border-t border-grey-100 pt-5 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-grey-500">{t("vehicle.location")}</dt>
          <dd className="font-medium text-grey-900">{locationCity}, {locationCountry}</dd>
        </div>
      </dl>
    </div>
  );
}

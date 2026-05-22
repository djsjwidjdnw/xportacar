import Link from "next/link";
import { ArrowRight, Car, Search } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Vehicle not found · XportACar",
  description: "We couldn't find the page you were looking for. Browse our live UAE-to-EU auctions instead.",
};

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] items-center bg-gradient-to-b from-brand-50/50 via-white to-white">
      <div className="mx-auto w-full max-w-2xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-grey-200 bg-white p-10 text-center shadow-xl sm:p-14">
          <div className="mx-auto grid size-20 place-items-center rounded-full bg-brand-50 ring-1 ring-brand-100">
            <Car className="size-10 text-brand-600" />
          </div>

          <p className="mt-6 text-sm font-bold uppercase tracking-[0.16em] text-brand-600">404</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-grey-900 sm:text-4xl">
            Vehicle not found
          </h1>
          <p className="mx-auto mt-3 max-w-md text-grey-600">
            The page or vehicle you were looking for doesn&apos;t exist — it may have been sold,
            relisted, or the link is wrong. Try searching the marketplace.
          </p>

          {/* Search form — routes to /marketplace with a query param.
              The marketplace page already reads `?q=` and prefills the
              search box, so this drops the user right into a filtered list. */}
          <form action="/marketplace" className="mx-auto mt-8 flex max-w-md items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-grey-400" />
              <input
                type="text"
                name="q"
                placeholder="Search Mercedes, BMW, VIN…"
                className="h-12 w-full rounded-lg border border-grey-200 bg-white pl-10 pr-3 text-sm font-medium text-grey-900 placeholder:text-grey-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
              />
            </div>
            <button
              type="submit"
              className={cn(buttonVariants({ variant: "default", size: "lg" }), "h-12 px-5")}
            >
              Search
            </button>
          </form>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/marketplace"
              className={cn(buttonVariants({ variant: "default", size: "lg" }), "h-11 px-5")}
            >
              Browse marketplace
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/auctions"
              className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-11 px-5")}
            >
              View live auctions
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

// Error boundary for all buyer pages (marketplace, auction, vehicle, dashboard,
// watchlist, profile). Renders inside the persistent buyer chrome so navigation
// stays intact; recovers via reset() without a full reload.

import Link from "next/link";
import { useEffect } from "react";

export default function BuyerError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[buyer-error]", error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-6 text-center">
      <h1 className="text-xl font-extrabold text-gray-900">Something went wrong</h1>
      <p className="mt-2 text-sm text-gray-600">
        We hit an unexpected error loading this page. You can try again or head back to the marketplace.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={() => reset()}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
        >
          Try again
        </button>
        <Link
          href="/marketplace"
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
        >
          Back to marketplace
        </Link>
      </div>
      {error.digest ? <p className="mt-4 text-xs text-gray-400">Reference: {error.digest}</p> : null}
    </div>
  );
}

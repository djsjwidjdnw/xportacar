"use client";

import { useEffect } from "react";
import { Info } from "lucide-react";

// Shown on /marketplace?notice=listing-unavailable when someone followed a
// link to a car that has been removed. The param is stripped from the address
// bar on mount so a refresh, share or saved search doesn't repeat it.
export function ListingUnavailableNotice({ message }: { message: string }) {
  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("notice")) return;
    url.searchParams.delete("notice");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }, []);

  return (
    <div
      role="status"
      className="mb-6 flex items-center gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-medium text-brand-800"
    >
      <Info className="size-4 shrink-0 text-brand-600" />
      <span>{message}</span>
    </div>
  );
}

"use client";

// Client-side view of app_settings.bidding_enabled. The value is read once on
// the server by getAppSettings() (src/lib/settings.ts) and handed down through
// this context, so client components never query the flag themselves.

import { createContext, useContext } from "react";

const BiddingContext = createContext(false);

export function BiddingProvider({ enabled, children }: { enabled: boolean; children: React.ReactNode }) {
  return <BiddingContext.Provider value={enabled}>{children}</BiddingContext.Provider>;
}

export function useBiddingEnabled(): boolean {
  return useContext(BiddingContext);
}

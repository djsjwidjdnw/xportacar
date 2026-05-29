// Client-safe types and defaults for platform settings. Pure data — no
// imports of the admin Supabase client, so this file can be imported
// from client components (Form) and server modules alike.

export interface PlatformSettings {
  platformName:          string;
  feePercentage:         number;
  defaultAuctionDays:    number;
  minBidIncrementEur:    number;
  reserveEnforced:       boolean;
  proxyBiddingEnabled:   boolean;
  buyNowEnabled:         boolean;
}

export const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
  platformName:        "XportACar",
  feePercentage:       2.9,
  defaultAuctionDays:  7,
  minBidIncrementEur:  100,
  reserveEnforced:     true,
  proxyBiddingEnabled: true,
  buyNowEnabled:       true,
};

export function sanitizePlatformSettings(raw: Partial<PlatformSettings>): PlatformSettings {
  const fee = Number(raw.feePercentage ?? DEFAULT_PLATFORM_SETTINGS.feePercentage);
  return {
    platformName: typeof raw.platformName === "string" && raw.platformName.trim()
      ? raw.platformName.trim() : DEFAULT_PLATFORM_SETTINGS.platformName,
    feePercentage: Number.isFinite(fee) ? Math.min(50, Math.max(0, fee)) : DEFAULT_PLATFORM_SETTINGS.feePercentage,
    defaultAuctionDays: Math.min(60, Math.max(1, Math.floor(Number(raw.defaultAuctionDays ?? DEFAULT_PLATFORM_SETTINGS.defaultAuctionDays)) || DEFAULT_PLATFORM_SETTINGS.defaultAuctionDays)),
    minBidIncrementEur: Math.min(10000, Math.max(1, Math.floor(Number(raw.minBidIncrementEur ?? DEFAULT_PLATFORM_SETTINGS.minBidIncrementEur)) || DEFAULT_PLATFORM_SETTINGS.minBidIncrementEur)),
    reserveEnforced:     raw.reserveEnforced     ?? DEFAULT_PLATFORM_SETTINGS.reserveEnforced,
    proxyBiddingEnabled: raw.proxyBiddingEnabled ?? DEFAULT_PLATFORM_SETTINGS.proxyBiddingEnabled,
    buyNowEnabled:       raw.buyNowEnabled       ?? DEFAULT_PLATFORM_SETTINGS.buyNowEnabled,
  };
}

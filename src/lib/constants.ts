// App-wide constants and small enums.

export const SUPPORTED_LOCALES = ["en", "de", "ar", "fr"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const RTL_LOCALES: ReadonlyArray<Locale> = ["ar"];
export const LOCALE_COOKIE = "xpc_locale";

export const LOCALE_NAMES: Record<Locale, { name: string; flag: string }> = {
  en: { name: "English",   flag: "🇬🇧" },
  de: { name: "Deutsch",   flag: "🇩🇪" },
  ar: { name: "العربية",  flag: "🇦🇪" },
  fr: { name: "Français",  flag: "🇫🇷" },
};

// Bid increment ladder (EUR) — used by the bid panel.
export const BID_INCREMENT_LADDER: Array<{ uptoEur: number; stepEur: number }> = [
  { uptoEur: 5_000,    stepEur: 100 },
  { uptoEur: 25_000,   stepEur: 250 },
  { uptoEur: 75_000,   stepEur: 500 },
  { uptoEur: 250_000,  stepEur: 1000 },
  { uptoEur: Infinity, stepEur: 2500 },
];

export function bidIncrement(currentEur: number): number {
  for (const tier of BID_INCREMENT_LADDER) {
    if (currentEur < tier.uptoEur) return tier.stepEur;
  }
  return 2500;
}

export const MAKES = [
  "All makes",
  "Audi", "BMW", "Land Rover", "Lexus", "Mercedes-Benz",
  "Nissan", "Porsche", "Toyota",
] as const;

export const BODY_TYPES = ["All body types", "SUV", "Sedan", "Coupe", "Hatchback", "Pickup"] as const;
export const FUEL_TYPES = ["All fuel types", "petrol", "diesel", "hybrid", "electric"] as const;
export const TRANSMISSIONS = ["All", "automatic", "manual"] as const;
export const SORT_OPTIONS = [
  { value: "ending_soon",     labelKey: "marketplace.sortEndingSoon" },
  { value: "price_asc",       labelKey: "marketplace.sortPriceAsc" },
  { value: "price_desc",      labelKey: "marketplace.sortPriceDesc" },
  { value: "newest",          labelKey: "marketplace.sortNewest" },
  { value: "mileage_asc",     labelKey: "marketplace.sortMileageAsc" },
] as const;

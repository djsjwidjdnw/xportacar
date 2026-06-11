// Door-to-door shipping distance from Hamburg port to major EU cities, and the
// pricing helpers shared by the web + mobile Buy-Now / win flows.
//
//   Standard port shipping ......... €4500 flat (any destination)
//   Door-to-door ................... €4500 + €3.50 / km from Hamburg
//
// Distances are pre-computed road km from Hamburg (city not in the table → the
// country default; unknown country → OTHER_DEFAULT_KM). Kept as a plain lookup
// so it works offline / in the RN bundle with no API call.

export const PORT_FLAT_EUR = 4500;
export const DOOR_PER_KM_EUR = 3.5;
export const OTHER_DEFAULT_KM = 800;

// km from Hamburg port. Keys are lowercased country → city → km.
const DISTANCE_KM: Record<string, { _default: number; cities: Record<string, number> }> = {
  germany: {
    _default: 400,
    cities: {
      berlin: 290, munich: 770, hamburg: 0, frankfurt: 490, cologne: 430,
      stuttgart: 670, "düsseldorf": 410, dusseldorf: 410, hannover: 150,
      hanover: 150, leipzig: 380, dresden: 470,
    },
  },
  netherlands: { _default: 460, cities: { amsterdam: 460, rotterdam: 460, "the hague": 480, "den haag": 480 } },
  belgium: { _default: 580, cities: { brussels: 600, antwerp: 560, antwerpen: 560 } },
  austria: { _default: 880, cities: { vienna: 900, wien: 900, salzburg: 850, innsbruck: 870 } },
  france: { _default: 850, cities: { paris: 800, lyon: 1100, strasbourg: 700 } },
  switzerland: { _default: 950, cities: { zurich: 850, "zürich": 850, geneva: 1050, "genève": 1050 } },
  "czech republic": { _default: 600, cities: { prague: 600, praha: 600 } },
  czechia: { _default: 600, cities: { prague: 600, praha: 600 } },
  poland: { _default: 780, cities: { warsaw: 720, warszawa: 720, krakow: 850, "kraków": 850 } },
};

/** Pre-computed road km from Hamburg to {country, city}. Falls back gracefully. */
export function distanceFromHamburgKm(country: string | null | undefined, city: string | null | undefined): number {
  const co = (country ?? "").trim().toLowerCase();
  const ci = (city ?? "").trim().toLowerCase();
  const entry = DISTANCE_KM[co];
  if (!entry) return OTHER_DEFAULT_KM;
  if (ci && entry.cities[ci] != null) return entry.cities[ci];
  return entry._default;
}

export type ShippingKind = "standard" | "door_to_door";

/** Shipping cost in EUR for the chosen method. Door-to-door = flat + €3.50/km. */
export function shippingCostEur(kind: ShippingKind, distanceKm = 0): number {
  if (kind === "standard") return PORT_FLAT_EUR;
  return PORT_FLAT_EUR + Math.round(distanceKm * DOOR_PER_KM_EUR);
}

/** Sorted list of countries we have distance data for (Title Case for UI). */
export function knownCountries(): string[] {
  return Object.keys(DISTANCE_KM)
    .map((c) => c.replace(/\b\w/g, (m) => m.toUpperCase()))
    .sort();
}

/** Cities we have data for in a country (Title Case), for an optional dropdown. */
export function knownCities(country: string | null | undefined): string[] {
  const entry = DISTANCE_KM[(country ?? "").trim().toLowerCase()];
  if (!entry) return [];
  return Object.keys(entry.cities)
    .filter((c) => !/[äöü]/.test(c) === true) // prefer ascii spellings, dedupe accents
    .map((c) => c.replace(/\b\w/g, (m) => m.toUpperCase()))
    .sort();
}

export const TUV_EUR = 3500;

export interface ExtraItem { name: string; price_eur: number }

/** Available optional extras (German Registration / TÜV, etc.). */
export const AVAILABLE_EXTRAS: ExtraItem[] = [
  { name: "German Registration (TÜV)", price_eur: TUV_EUR },
];

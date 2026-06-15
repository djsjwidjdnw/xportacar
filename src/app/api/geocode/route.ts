// Server-side proxy for OpenStreetMap Nominatim address autocomplete.
//
// The browser can't call Nominatim directly: fetch() forbids setting a custom
// User-Agent (which Nominatim's usage policy requires), and a direct call would
// also leak the buyer's keystrokes cross-origin. We proxy here, attach the
// required UA, restrict to EU + UK, and cap results. GET /api/geocode?q=<query>
import type { NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

// EU + UK ISO codes the platform ships door-to-door to.
const COUNTRY_CODES = "de,nl,be,fr,at,it,es,pl,cz,ch,dk,se,no,fi,pt,ie,gb,lu";

interface GeocodeSuggestion {
  label: string;        // human-readable single line
  line1: string;        // house number + road
  line2: string;        // suburb / neighbourhood (optional)
  city: string;
  postalCode: string;
  country: string;      // ISO 3166-1 alpha-2, uppercased
  lat: number;
  lon: number;
}

type NominatimAddress = {
  house_number?: string; road?: string; pedestrian?: string;
  neighbourhood?: string; suburb?: string; city_district?: string;
  city?: string; town?: string; village?: string; municipality?: string;
  postcode?: string; country_code?: string;
};

export async function GET(req: NextRequest) {
  // Auth gate — only signed-in buyers (filling out their own invoice) hit this.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ suggestions: [] }, { status: 401 });

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 3) return Response.json({ suggestions: [] });

  // Filter to a single selected country (e.g. "de") when provided — far better
  // results than searching all of EU+UK at once. Falls back to the full list.
  const reqCountry = (req.nextUrl.searchParams.get("country") ?? "").trim().toLowerCase();
  const countryCodes = /^[a-z]{2}$/.test(reqCountry) && COUNTRY_CODES.split(",").includes(reqCountry)
    ? reqCountry
    : COUNTRY_CODES;

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "json");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "5");
  url.searchParams.set("countrycodes", countryCodes);
  url.searchParams.set("q", q);

  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(url, {
      headers: {
        "User-Agent": "XportACar/1.0 (contact@xportacar.com)",
        "Accept-Language": "en",
      },
      signal: controller.signal,
    });
    clearTimeout(t);
    if (!res.ok) return Response.json({ suggestions: [] });

    const raw: Array<{ lat: string; lon: string; display_name: string; address?: NominatimAddress }> = await res.json();
    const suggestions: GeocodeSuggestion[] = raw.map((r) => {
      const a = r.address ?? {};
      const line1 = [a.house_number, a.road ?? a.pedestrian].filter(Boolean).join(" ");
      const city = a.city ?? a.town ?? a.village ?? a.municipality ?? a.city_district ?? "";
      const line2 = a.suburb ?? a.neighbourhood ?? "";
      return {
        label: r.display_name,
        line1,
        line2: line2 && line2 !== city ? line2 : "",
        city,
        postalCode: a.postcode ?? "",
        country: (a.country_code ?? "").toUpperCase(),
        lat: Number(r.lat),
        lon: Number(r.lon),
      };
    });
    return Response.json({ suggestions });
  } catch {
    return Response.json({ suggestions: [] });
  }
}

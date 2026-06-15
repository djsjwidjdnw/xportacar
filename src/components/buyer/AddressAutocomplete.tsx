"use client";

// Structured door-to-door delivery address with OpenStreetMap (Nominatim)
// autofill. Typing in the street field debounces a lookup against our
// /api/geocode proxy (which attaches the required User-Agent server-side and
// restricts to EU + UK); picking a suggestion fills every field and stores the
// lat/lon used for the Haversine distance from Hamburg.

import { useEffect, useRef, useState } from "react";
import { Loader2, MapPin } from "lucide-react";

export interface DeliveryAddress {
  line1: string;
  line2: string;
  city: string;
  postalCode: string;
  country: string; // ISO 3166-1 alpha-2
  lat: number | null;
  lon: number | null;
}

export const EMPTY_DELIVERY_ADDRESS: DeliveryAddress = {
  line1: "", line2: "", city: "", postalCode: "", country: "", lat: null, lon: null,
};

// EU + UK door-to-door destinations (ISO-2 → name). Matches /api/geocode codes.
export const SHIP_COUNTRIES: { code: string; name: string }[] = [
  { code: "DE", name: "Germany" },
  { code: "NL", name: "Netherlands" },
  { code: "BE", name: "Belgium" },
  { code: "FR", name: "France" },
  { code: "AT", name: "Austria" },
  { code: "IT", name: "Italy" },
  { code: "ES", name: "Spain" },
  { code: "PT", name: "Portugal" },
  { code: "PL", name: "Poland" },
  { code: "CZ", name: "Czechia" },
  { code: "CH", name: "Switzerland" },
  { code: "DK", name: "Denmark" },
  { code: "SE", name: "Sweden" },
  { code: "NO", name: "Norway" },
  { code: "FI", name: "Finland" },
  { code: "IE", name: "Ireland" },
  { code: "LU", name: "Luxembourg" },
  { code: "GB", name: "United Kingdom" },
];

export function countryName(code: string): string {
  return SHIP_COUNTRIES.find((c) => c.code === code.toUpperCase())?.name ?? code;
}

type Suggestion = {
  label: string; line1: string; line2: string; city: string;
  postalCode: string; country: string; lat: number; lon: number;
};

const inputCls = "h-10 w-full rounded-lg border border-grey-200 px-3 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100";
const labelCls = "mb-1 block text-[11px] font-semibold uppercase tracking-wide text-grey-500";

export function AddressAutocomplete({
  value, onChange,
}: {
  value: DeliveryAddress;
  onChange: (next: DeliveryAddress) => void;
}) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNext = useRef(false);
  const boxRef = useRef<HTMLDivElement | null>(null);

  // Close suggestions on outside click.
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  // Debounced lookup off the street field (500ms → respects Nominatim 1 req/s).
  useEffect(() => {
    if (skipNext.current) { skipNext.current = false; return; }
    const q = value.line1.trim();
    if (timer.current) clearTimeout(timer.current);
    if (q.length < 3) { setSuggestions([]); setOpen(false); return; }
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const qFull = value.country ? `${q}, ${countryName(value.country)}` : q;
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(qFull)}`);
        const data: { suggestions?: Suggestion[] } = await res.json();
        const list = data.suggestions ?? [];
        setSuggestions(list);
        setOpen(list.length > 0);
      } catch {
        setSuggestions([]); setOpen(false);
      } finally {
        setLoading(false);
      }
    }, 500);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [value.line1, value.country]);

  // Pick a suggestion → fill every field + store geocoded coordinates.
  const pick = (s: Suggestion) => {
    skipNext.current = true; // don't re-query off the field we just filled
    onChange({
      line1: s.line1 || value.line1,
      line2: s.line2 || value.line2,
      city: s.city || value.city,
      postalCode: s.postalCode || value.postalCode,
      country: s.country || value.country,
      lat: s.lat,
      lon: s.lon,
    });
    setOpen(false);
    setSuggestions([]);
  };

  // Manual edits (except apartment line) invalidate the geocoded coordinates.
  const setField = (patch: Partial<DeliveryAddress>, keepCoords = false) =>
    onChange({ ...value, ...patch, ...(keepCoords ? {} : { lat: null, lon: null }) });

  return (
    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
      {/* Street line 1 — drives the autofill */}
      <div className="relative sm:col-span-2" ref={boxRef}>
        <label className={labelCls}>Street address *</label>
        <div className="relative">
          <input
            value={value.line1}
            onChange={(e) => setField({ line1: e.target.value })}
            onFocus={() => suggestions.length > 0 && setOpen(true)}
            placeholder="Start typing, e.g. Maximilianstraße 12"
            autoComplete="off"
            className={inputCls}
          />
          {loading && (
            <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-grey-400" />
          )}
        </div>
        {open && suggestions.length > 0 && (
          <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-grey-200 bg-white py-1 shadow-lg">
            {suggestions.map((s, i) => (
              <li key={`${s.lat},${s.lon},${i}`}>
                <button
                  type="button"
                  onClick={() => pick(s)}
                  className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-brand-50"
                >
                  <MapPin className="mt-0.5 size-4 shrink-0 text-brand-500" />
                  <span className="text-grey-700">{s.label}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Apartment / unit — optional, keeps coordinates */}
      <div className="sm:col-span-2">
        <label className={labelCls}>Apartment / unit (optional)</label>
        <input
          value={value.line2}
          onChange={(e) => setField({ line2: e.target.value }, true)}
          placeholder="Apt 4B, Building C…"
          autoComplete="off"
          className={inputCls}
        />
      </div>

      <div>
        <label className={labelCls}>Postal code *</label>
        <input
          value={value.postalCode}
          onChange={(e) => setField({ postalCode: e.target.value })}
          placeholder="80539"
          autoComplete="off"
          className={inputCls}
        />
      </div>

      <div>
        <label className={labelCls}>City *</label>
        <input
          value={value.city}
          onChange={(e) => setField({ city: e.target.value })}
          placeholder="Munich"
          autoComplete="off"
          className={inputCls}
        />
      </div>

      <div className="sm:col-span-2">
        <label className={labelCls}>Country *</label>
        <select
          value={value.country}
          onChange={(e) => setField({ country: e.target.value })}
          className={inputCls}
        >
          <option value="">Select a country…</option>
          {SHIP_COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>{c.name}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

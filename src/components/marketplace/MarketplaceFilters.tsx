"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Filter, Search, SlidersHorizontal, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";

import { BODY_TYPES, FUEL_TYPES, MAKES, SORT_OPTIONS, TRANSMISSIONS } from "@/lib/constants";
import { useTranslations } from "@/i18n/provider";

const PRICE_RANGES = [
  { value: "any",    label: "marketplace.anyPrice" },
  { value: "0-50",   label: "Up to €50k" },
  { value: "50-80",  label: "€50k – €80k" },
  { value: "80-120", label: "€80k – €120k" },
  { value: "120+",   label: "€120k+" },
];

const YEARS = ["any", "2024", "2023", "2022", "2021", "2020", "2019", "2018"];

export function MarketplaceFilters() {
  const router = useRouter();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const t = useTranslations();

  const get = useCallback((k: string, fallback = "") => params.get(k) ?? fallback, [params]);

  const update = useCallback(
    (key: string, value: string | null) => {
      const next = new URLSearchParams(params.toString());
      if (!value || value === "any" || value.startsWith("All")) next.delete(key);
      else next.set(key, value);
      startTransition(() => {
        router.replace(`/marketplace${next.toString() ? `?${next.toString()}` : ""}`, { scroll: false });
      });
    },
    [params, router],
  );

  // Debounced search input — replaces URL ~300 ms after typing stops.
  const [searchInput, setSearchInput] = useState(params.get("q") ?? "");
  const debounceRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    if ((params.get("q") ?? "") === searchInput) return;
    debounceRef.current = window.setTimeout(() => {
      update("q", searchInput);
    }, 300);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  const activeFilterCount = useMemo(
    () => ["q", "make", "year", "price", "fuel", "body", "transmission"]
      .filter((k) => params.get(k)).length,
    [params],
  );

  const filterFields = (
    <>
      <FilterSelect label={t("marketplace.filterMake")} value={get("make", "All makes")} onChange={(v) => update("make", v)}
        options={MAKES.map((m) => ({ value: m, label: m }))} />
      <FilterSelect label={t("marketplace.filterYear")} value={get("year", "any")} onChange={(v) => update("year", v)}
        options={YEARS.map((y) => ({ value: y, label: y === "any" ? t("marketplace.anyYear") : y }))} />
      <FilterSelect label={t("marketplace.filterPriceRange")} value={get("price", "any")} onChange={(v) => update("price", v)}
        options={PRICE_RANGES.map((p) => ({ value: p.value, label: p.label.startsWith("marketplace.") ? t(p.label) : p.label }))} />
      <FilterSelect label={t("marketplace.filterFuel")} value={get("fuel", "All fuel types")} onChange={(v) => update("fuel", v)}
        options={FUEL_TYPES.map((f) => ({ value: f, label: f === "All fuel types" ? f : f.charAt(0).toUpperCase() + f.slice(1) }))} />
      <FilterSelect label={t("marketplace.filterBody")} value={get("body", "All body types")} onChange={(v) => update("body", v)}
        options={BODY_TYPES.map((b) => ({ value: b, label: b }))} />
      <FilterSelect label={t("marketplace.filterTransmission")} value={get("transmission", "All")} onChange={(v) => update("transmission", v)}
        options={TRANSMISSIONS.map((t) => ({ value: t, label: t === "All" ? "All" : t.charAt(0).toUpperCase() + t.slice(1) }))} />
    </>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-grey-400" />
          <Input
            value={searchInput}
            placeholder={t("marketplace.searchPlaceholder")}
            onChange={(e) => setSearchInput(e.currentTarget.value)}
            className="h-11 pl-10 text-sm"
          />
        </div>

        {/* Mobile-only Filters button — opens a slide-up sheet with the
            same filter selects laid out vertically. Hidden on md+ where
            the full grid is shown inline below. */}
        <Sheet>
          <SheetTrigger
            render={
              <Button
                variant="outline"
                className="relative h-11 w-full justify-center sm:w-auto md:hidden"
              >
                <Filter className="size-4" />
                Filters
                {activeFilterCount > 0 && (
                  <span className="ml-1 inline-flex size-5 items-center justify-center rounded-full bg-brand-600 text-[10px] font-bold text-white">
                    {activeFilterCount}
                  </span>
                )}
              </Button>
            }
          />
          <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto rounded-t-2xl">
            <SheetHeader>
              <SheetTitle>Filters &amp; sort</SheetTitle>
            </SheetHeader>
            <div className="space-y-3 px-4 pb-6">
              <div>
                <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-grey-500">Sort by</p>
                <Select value={get("sort", "ending_soon")} onValueChange={(v) => update("sort", v as string)}>
                  <SelectTrigger size="default" className="h-11 w-full">
                    <SlidersHorizontal className="size-4 text-grey-500" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SORT_OPTIONS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{t(s.labelKey)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wide text-grey-500">Filters</p>
                <div className="grid gap-2">{filterFields}</div>
              </div>
              {activeFilterCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    setSearchInput("");
                    startTransition(() => router.replace("/marketplace", { scroll: false }));
                  }}
                >
                  <X className="size-3.5" />
                  {t("marketplace.clearFilters")}
                </Button>
              )}
              <SheetClose
                render={
                  <Button className="h-11 w-full">
                    Show {/* count handled by route — closes the sheet */} results
                  </Button>
                }
              />
            </div>
          </SheetContent>
        </Sheet>

        {/* Sort dropdown — desktop only (mobile users get it in the sheet) */}
        <Select value={get("sort", "ending_soon")} onValueChange={(v) => update("sort", v as string)}>
          <SelectTrigger size="default" className="hidden h-11 w-56 md:flex">
            <SlidersHorizontal className="size-4 text-grey-500" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((s) => (
              <SelectItem key={s.value} value={s.value}>{t(s.labelKey)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Desktop filter grid */}
      <div className="hidden gap-2 md:grid md:grid-cols-3 lg:grid-cols-6">
        {filterFields}
      </div>

      {activeFilterCount > 0 && (
        <div className="hidden items-center justify-end md:flex">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearchInput("");
              startTransition(() => router.replace("/marketplace", { scroll: false }));
            }}
          >
            <X className="size-3.5" />
            {t("marketplace.clearFilters")}
          </Button>
        </div>
      )}

      {isPending && <div aria-hidden className="h-0.5 w-full animate-pulse rounded bg-brand-200" />}
    </div>
  );
}

function FilterSelect({
  label, value, onChange, options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as string)}>
      <SelectTrigger className="h-11 w-full justify-between">
        <span className="truncate">
          <span className="text-grey-500">{label}: </span>
          <span className="font-medium text-grey-900">
            {options.find((o) => o.value === value)?.label ?? value}
          </span>
        </span>
        <SelectValue className="hidden" />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

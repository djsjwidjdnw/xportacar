"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function PhotoGallery({
  photos, alt,
}: {
  photos: { url: string; caption: string | null }[];
  alt: string;
}) {
  const [index, setIndex] = useState(0);
  const safe = photos.length > 0 ? photos : [{ url: "https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=1600&q=80", caption: null }];
  const active = safe[index] ?? safe[0];

  const prev = useCallback(() => setIndex((i) => (i - 1 + safe.length) % safe.length), [safe.length]);
  const next = useCallback(() => setIndex((i) => (i + 1) % safe.length), [safe.length]);

  return (
    <div>
      <div className="relative aspect-[16/10] w-full overflow-hidden rounded-2xl bg-grey-100 ring-1 ring-grey-200">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={active.url} alt={active.caption ?? alt} className="size-full object-cover" />

        {safe.length > 1 && (
          <>
            <Button
              variant="outline" size="icon" aria-label="Previous photo"
              onClick={prev}
              className="absolute left-3 top-1/2 size-10 -translate-y-1/2 rounded-full bg-white/90 shadow"
            >
              <ChevronLeft className="size-5" />
            </Button>
            <Button
              variant="outline" size="icon" aria-label="Next photo"
              onClick={next}
              className="absolute right-3 top-1/2 size-10 -translate-y-1/2 rounded-full bg-white/90 shadow"
            >
              <ChevronRight className="size-5" />
            </Button>

            <div className="absolute bottom-3 right-3 rounded-full bg-grey-900/80 px-2.5 py-1 text-xs font-medium text-white">
              {index + 1} / {safe.length}
            </div>
          </>
        )}
      </div>

      {safe.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
          {safe.map((p, i) => (
            <button
              key={p.url + i}
              onClick={() => setIndex(i)}
              type="button"
              aria-label={`Go to photo ${i + 1}`}
              className={cn(
                "shrink-0 overflow-hidden rounded-lg ring-1 transition-all",
                i === index
                  ? "ring-2 ring-brand-600"
                  : "ring-grey-200 hover:ring-grey-300",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.url}
                alt=""
                className={cn(
                  "h-16 w-24 object-cover transition-opacity",
                  i === index ? "" : "opacity-70 hover:opacity-100",
                )}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import { ChevronLeft, ChevronRight, Maximize2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function PhotoGallery({
  photos, alt,
}: {
  photos: { url: string; caption: string | null }[];
  alt: string;
}) {
  const [index, setIndex] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  // Neutral local placeholder when there are no photos — never a random stock car.
  const safe = photos.length > 0 ? photos : [{ url: "/placeholder/no-photo.svg", caption: null }];
  const active = safe[index] ?? safe[0];

  const prev = useCallback(() => setIndex((i) => (i - 1 + safe.length) % safe.length), [safe.length]);
  const next = useCallback(() => setIndex((i) => (i + 1) % safe.length), [safe.length]);

  // Keyboard navigation in the lightbox: arrows to navigate, Esc to close.
  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(false);
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    // Lock body scroll while the lightbox is open.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [lightbox, prev, next]);

  return (
    <>
      <div>
        <div className="group relative aspect-[16/10] w-full overflow-hidden rounded-2xl bg-grey-100 ring-1 ring-grey-200">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={active.url}
            alt={active.caption ?? alt}
            className="size-full cursor-zoom-in object-cover transition-transform hover:scale-105"
            onClick={() => setLightbox(true)}
          />

          <button
            type="button"
            onClick={() => setLightbox(true)}
            aria-label="Open fullscreen"
            className="absolute right-3 top-3 grid size-9 place-items-center rounded-full bg-grey-900/70 text-white opacity-0 backdrop-blur transition-opacity hover:bg-grey-900/85 group-hover:opacity-100"
          >
            <Maximize2 className="size-4" />
          </button>

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

      {/* Fullscreen lightbox — escape closes, arrows navigate, click backdrop closes */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-grey-900/95 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={`Photo ${index + 1} of ${safe.length}`}
          onClick={() => setLightbox(false)}
        >
          {/* Close */}
          <button
            type="button"
            onClick={() => setLightbox(false)}
            aria-label="Close"
            className="absolute right-4 top-4 grid size-11 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
          >
            <X className="size-5" />
          </button>

          {/* Counter */}
          <div className="absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-sm font-medium text-white">
            {index + 1} / {safe.length}
          </div>

          {/* Prev / Next */}
          {safe.length > 1 && (
            <>
              <button
                type="button"
                aria-label="Previous photo"
                onClick={(e) => { e.stopPropagation(); prev(); }}
                className="absolute left-4 top-1/2 grid size-12 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
              >
                <ChevronLeft className="size-6" />
              </button>
              <button
                type="button"
                aria-label="Next photo"
                onClick={(e) => { e.stopPropagation(); next(); }}
                className="absolute right-4 top-1/2 grid size-12 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
              >
                <ChevronRight className="size-6" />
              </button>
            </>
          )}

          {/* Image — flex child of the centered overlay; no asymmetric padding
              so it sits perfectly centred both axes. */}
          <div
            className="flex max-h-[90vh] max-w-[92vw] flex-col items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={active.url}
              alt={active.caption ?? alt}
              className="max-h-[82vh] max-w-[88vw] rounded-lg object-contain"
            />
            {active.caption && (
              <p className="mt-3 text-center text-sm text-white/80">{active.caption}</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}

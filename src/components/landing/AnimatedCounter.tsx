"use client";

import { useEffect, useRef, useState } from "react";

// Counts from 0 to `value` over `durationMs` once the element scrolls into
// view. Uses requestAnimationFrame + an ease-out curve so the number
// decelerates as it approaches the target — feels much more polished than
// a linear ramp. Re-runs if `value` changes.
export function AnimatedCounter({
  value,
  durationMs = 1400,
  format = (n) => n.toLocaleString("en-GB"),
}: {
  value: number;
  durationMs?: number;
  format?: (n: number) => string;
}) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [display, setDisplay] = useState(0);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const observer = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting && !startedRef.current) {
          startedRef.current = true;
          const start = performance.now();
          const tick = (now: number) => {
            const t = Math.min(1, (now - start) / durationMs);
            const eased = 1 - Math.pow(1 - t, 3);
            setDisplay(Math.round(value * eased));
            if (t < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
          observer.disconnect();
        }
      }
    }, { threshold: 0.3 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [value, durationMs]);

  return <span ref={ref}>{format(display)}</span>;
}

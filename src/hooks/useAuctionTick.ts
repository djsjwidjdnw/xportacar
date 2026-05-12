"use client";

// Cheap 1-second tick that returns a formatted "Xd Yh / HH:MM:SS" string.
// Avoids using a global ticker — each consumer has its own setInterval but
// the work is trivial (one Date diff + format) so this is fine.

import { useEffect, useState } from "react";
import { formatTimeRemaining } from "@/lib/utils";

export function useAuctionTick(endIso?: string | null) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!endIso) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [endIso]);

  if (!endIso) return "";
  return formatTimeRemaining(endIso, new Date(now));
}

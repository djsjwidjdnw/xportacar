"use client";

// Reads ?welcome=1 / ?signedOut=1 search params and pops a one-off toast.
// Mounted in the buyer layout so it fires regardless of which page the
// redirect target is.

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { toast } from "@/components/ui/toast";

export function WelcomeToast() {
  const params = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    if (params.get("welcome") === "1") {
      toast.ok("Welcome to XportACar", "Your trade account is ready — start browsing.");
      const next = new URLSearchParams(params.toString());
      next.delete("welcome");
      router.replace(`${window.location.pathname}${next.toString() ? `?${next.toString()}` : ""}`, { scroll: false });
    } else if (params.get("signedOut") === "1") {
      toast.info("Signed out", "See you next auction.");
      const next = new URLSearchParams(params.toString());
      next.delete("signedOut");
      router.replace(`${window.location.pathname}${next.toString() ? `?${next.toString()}` : ""}`, { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  return null;
}

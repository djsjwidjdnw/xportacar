"use client";

import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import { useTransition, useState } from "react";

import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { toggleWatchlistAction } from "@/app/(buyer)/watchlist/actions";
import { cn } from "@/lib/utils";

export function WatchlistButton({
  vehicleId,
  initiallyWatching,
  isAuthenticated,
  vehicleTitle,
  variant = "icon",
}: {
  vehicleId: string;
  initiallyWatching: boolean;
  isAuthenticated: boolean;
  vehicleTitle?: string;
  variant?: "icon" | "full";
}) {
  const router = useRouter();
  const [watching, setWatching] = useState(initiallyWatching);
  const [isPending, startTransition] = useTransition();

  const onClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isAuthenticated) {
      router.push(`/login?next=/marketplace`);
      return;
    }
    const next = !watching;
    setWatching(next); // optimistic
    startTransition(async () => {
      const res = await toggleWatchlistAction(vehicleId);
      if (!res.ok) {
        setWatching(!next);
        toast.err("Watchlist failed", res.error);
        return;
      }
      if (res.watching) toast.ok("Added to watchlist", vehicleTitle);
      else toast.info("Removed from watchlist", vehicleTitle);
    });
  };

  if (variant === "icon") {
    return (
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label={watching ? "Remove from watchlist" : "Add to watchlist"}
        onClick={onClick}
        disabled={isPending}
        className={cn(
          "size-9 rounded-full bg-white/90 shadow",
          watching && "text-error-600 hover:text-error-700",
        )}
      >
        <Heart className={cn("size-4", watching && "fill-current")} />
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant={watching ? "secondary" : "outline"}
      onClick={onClick}
      disabled={isPending}
      className={cn(watching && "text-error-700")}
    >
      <Heart className={cn("size-4", watching && "fill-current")} />
      {watching ? "On watchlist" : "Add to watchlist"}
    </Button>
  );
}

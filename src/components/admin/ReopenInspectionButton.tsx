"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { reopenInspectionAction } from "@/app/(admin)/admin/actions";

// Returns a listed vehicle to the inspector (status → changes_requested) so they
// can update it, then re-submit for review. Logged to the admin audit trail.
export function ReopenInspectionButton({ vehicleId }: { vehicleId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      variant="outline"
      className="mt-2 w-full gap-1.5"
      disabled={pending}
      onClick={() => start(async () => {
        const res = await reopenInspectionAction(vehicleId);
        if (!res.ok) { toast.err("Couldn't re-open inspection", res.error); return; }
        toast.ok("Re-opened for inspection", "Sent back to the inspector to update.");
        router.refresh();
      })}
    >
      <RotateCcw className="size-4" />
      {pending ? "Re-opening…" : "Re-open inspection"}
    </Button>
  );
}

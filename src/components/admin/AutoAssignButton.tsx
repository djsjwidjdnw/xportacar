"use client";

// Method C — round-robin auto-assign. Distributes every unassigned vehicle
// across all inspectors, continuing the rotation from where it last stopped.

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Shuffle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { autoAssignInspectorsAction } from "@/app/(admin)/admin/actions";

export function AutoAssignButton() {
  const router = useRouter();
  const [pending, start] = useTransition();

  const run = () => {
    start(async () => {
      const res = await autoAssignInspectorsAction();
      if (!res.ok) { toast.err("Auto-assign failed", res.error); return; }
      if ((res.assigned ?? 0) === 0) {
        toast.info("Nothing to assign", "Every vehicle in the queue already has an inspector.");
      } else {
        toast.ok("Auto-assigned", `${res.assigned} vehicle${res.assigned === 1 ? "" : "s"} distributed across inspectors.`);
      }
      router.refresh();
    });
  };

  return (
    <Button size="sm" variant="outline" className="gap-1.5" onClick={run} disabled={pending}>
      <Shuffle className="size-4" />
      {pending ? "Assigning…" : "Auto-Assign"}
    </Button>
  );
}

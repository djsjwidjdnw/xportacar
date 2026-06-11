// Presentational order-lifecycle timeline shown on the buyer's won/order views.
// Renders four fixed steps — Sold → Picked Up → In Transit → Delivered.
//
// A step is "complete" when there's a matching vehicle_status_events row (or,
// for Sold, the vehicle is already sold via vehicles.sold_at / status). The
// CURRENT step (= vehicles.status) is highlighted; later steps are greyed.
//
// Pure / server-renderable: all data arrives via props so the won page can fetch
// the events server-side. No "use client" needed.

import { Check, CircleDot, Package, Ship, Truck, Trophy } from "lucide-react";

import { cn } from "@/lib/utils";

// The four lifecycle statuses this timeline visualises, in order.
export const TIMELINE_STEPS = ["sold", "picked_up", "in_transit", "delivered"] as const;
export type TimelineStatus = (typeof TIMELINE_STEPS)[number];

export interface StatusEvent {
  status: string;
  note: string | null;
  created_at: string;
}

const STEP_ICON: Record<TimelineStatus, typeof Trophy> = {
  sold: Trophy,
  picked_up: Package,
  in_transit: Ship,
  delivered: Truck,
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function StatusTimeline({
  title,
  labels,
  currentStatus,
  soldAtIso,
  events,
}: {
  // "Order status"
  title: string;
  // Localised label for each step, keyed by status.
  labels: Record<TimelineStatus, string>;
  // The vehicle's current status (drives the highlighted "current" step).
  currentStatus: string | null;
  // Fallback timestamp for the Sold step when no explicit event row exists.
  soldAtIso: string | null;
  // vehicle_status_events rows for this vehicle.
  events: StatusEvent[];
}) {
  // Index the most recent event per status so we can show its date + note.
  const eventByStatus = new Map<string, StatusEvent>();
  for (const e of events) {
    const prev = eventByStatus.get(e.status);
    if (!prev || new Date(e.created_at) > new Date(prev.created_at)) {
      eventByStatus.set(e.status, e);
    }
  }

  const currentIndex = TIMELINE_STEPS.indexOf(currentStatus as TimelineStatus);

  return (
    <div className="rounded-2xl border border-grey-200 bg-white p-6 shadow-sm sm:p-7">
      <h2 className="text-sm font-extrabold uppercase tracking-wide text-grey-500">
        {title}
      </h2>

      <ol className="mt-5 space-y-0">
        {TIMELINE_STEPS.map((step, i) => {
          const event = eventByStatus.get(step);
          // Sold also counts as complete once the vehicle is sold, even without
          // an explicit event row (older orders predate the events table).
          const soldComplete = step === "sold" && (!!soldAtIso || currentStatus === "sold" || currentIndex > 0);
          const isComplete = !!event || soldComplete;
          const isCurrent = currentStatus === step;
          const dateIso = event?.created_at ?? (step === "sold" ? soldAtIso : null);

          const Icon = STEP_ICON[step];
          const isLast = i === TIMELINE_STEPS.length - 1;

          return (
            <li key={step} className="flex gap-4">
              {/* Rail: marker + connector */}
              <div className="flex flex-col items-center">
                <span
                  className={cn(
                    "grid size-9 shrink-0 place-items-center rounded-full border-2 transition-colors",
                    isComplete
                      ? "border-success-600 bg-success-600 text-white"
                      : isCurrent
                        ? "border-brand-600 bg-brand-50 text-brand-600"
                        : "border-grey-200 bg-grey-50 text-grey-300",
                  )}
                >
                  {isComplete ? (
                    <Check className="size-4" />
                  ) : isCurrent ? (
                    <CircleDot className="size-4" />
                  ) : (
                    <Icon className="size-4" />
                  )}
                </span>
                {!isLast && (
                  <span
                    className={cn(
                      "w-0.5 flex-1",
                      isComplete ? "bg-success-600" : "bg-grey-200",
                    )}
                    style={{ minHeight: 28 }}
                  />
                )}
              </div>

              {/* Step content */}
              <div className={cn("pb-6", isLast && "pb-0")}>
                <p
                  className={cn(
                    "text-sm font-bold",
                    isComplete
                      ? "text-grey-900"
                      : isCurrent
                        ? "text-brand-700"
                        : "text-grey-400",
                  )}
                >
                  {labels[step]}
                </p>
                {dateIso && (
                  <p className="mt-0.5 text-xs font-medium text-grey-500">
                    {formatDate(dateIso)}
                  </p>
                )}
                {event?.note && (
                  <p className="mt-1 text-xs text-grey-600">{event.note}</p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

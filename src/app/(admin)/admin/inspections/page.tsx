import Link from "next/link";
import {
  ClipboardCheck, Camera, ExternalLink, Inbox, Hourglass, Eye, AlertTriangle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { InspectorAssign } from "@/components/admin/InspectorAssign";
import { AutoAssignButton } from "@/components/admin/AutoAssignButton";
import { createClient } from "@/lib/supabase/server";
import { formatRelativeTime } from "@/lib/utils";

export const metadata = { title: "Inspections · Admin" };

interface Inspector { id: string; full_name: string | null; email: string | null }
interface Row {
  id: string;
  year: number;
  make: string;
  model: string;
  vin: string;
  status: string;
  inspection_date: string | null;
  location_city: string;
  inspector_id: string | null;
  review_notes: string | null;
  inspector: Inspector | null;
}

export default async function AdminInspectionsPage() {
  const supabase = await createClient();

  const [
    { data: rowsRaw, error },
    { data: inspectorsRaw },
    { data: photoCountsRaw },
  ] = await Promise.all([
    supabase
      .from("vehicles")
      .select(`
        id, year, make, model, vin, status, inspection_date, location_city, inspector_id, review_notes,
        inspector:profiles!inspector_id ( id, full_name, email )
      `)
      .in("status", ["draft", "inspection_scheduled", "inspected", "pending_review", "changes_requested"])
      .order("updated_at", { ascending: false }),
    supabase.from("profiles").select("id, full_name, email").eq("role", "inspector"),
    supabase.from("vehicle_photos").select("vehicle_id"),
  ]);

  const rows = (rowsRaw ?? []) as unknown as Row[];
  const inspectors = (inspectorsRaw ?? []) as Inspector[];

  const photoCount = new Map<string, number>();
  for (const r of (photoCountsRaw ?? []) as { vehicle_id: string }[]) {
    photoCount.set(r.vehicle_id, (photoCount.get(r.vehicle_id) ?? 0) + 1);
  }

  const unassigned = rows.filter((r) => !r.inspector_id && (r.status === "draft" || r.status === "inspection_scheduled"));
  const inProgress = rows.filter((r) => r.inspector_id && (r.status === "draft" || r.status === "inspection_scheduled" || r.status === "inspected"));
  const pendingReview = rows.filter((r) => r.status === "pending_review");
  const changesRequested = rows.filter((r) => r.status === "changes_requested");

  return (
    <div className="px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
      <Breadcrumbs className="mb-5" items={[{ label: "Inspections" }]} />
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-extrabold tracking-tight text-grey-900">
            <span className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-brand-100">
              <ClipboardCheck className="size-5" />
            </span>
            Inspections
          </h1>
          <p className="mt-2 text-grey-600">
            {rows.length} vehicles in the pipeline · {unassigned.length} unassigned · {pendingReview.length} awaiting review
          </p>
        </div>
        <AutoAssignButton />
      </header>

      {error ? (
        <div className="rounded-xl border border-error-200 bg-error-50 p-6 text-error-700">{error.message}</div>
      ) : (
        <div className="space-y-8">
          <Section
            title="Unassigned"
            hint="Vehicles needing an inspector"
            icon={<Inbox className="size-4" />}
            tone="warning"
            count={unassigned.length}
            rows={unassigned}
            inspectors={inspectors}
            photoCount={photoCount}
            kind="assign"
            emptyText="Every vehicle has an inspector. Nice."
          />
          <Section
            title="In Progress"
            hint="Assigned · being inspected"
            icon={<Hourglass className="size-4" />}
            tone="brand"
            count={inProgress.length}
            rows={inProgress}
            inspectors={inspectors}
            photoCount={photoCount}
            kind="assign"
            emptyText="No inspections in progress."
          />
          <Section
            title="Pending Review"
            hint="Inspected · awaiting your approval"
            icon={<Eye className="size-4" />}
            tone="warning"
            count={pendingReview.length}
            rows={pendingReview}
            inspectors={inspectors}
            photoCount={photoCount}
            kind="review"
            emptyText="Nothing waiting for review."
          />
          <Section
            title="Changes Requested"
            hint="Sent back to the inspector"
            icon={<AlertTriangle className="size-4" />}
            tone="error"
            count={changesRequested.length}
            rows={changesRequested}
            inspectors={inspectors}
            photoCount={photoCount}
            kind="changes"
            emptyText="No vehicles were sent back."
          />
        </div>
      )}
    </div>
  );
}

const TONE: Record<string, string> = {
  warning: "bg-warning-50 text-warning-700 ring-warning-600",
  brand:   "bg-brand-50 text-brand-700 ring-brand-100",
  error:   "bg-error-50 text-error-700 ring-error-600",
};

function Section({
  title, hint, icon, tone, count, rows, inspectors, photoCount, kind, emptyText,
}: {
  title: string;
  hint: string;
  icon: React.ReactNode;
  tone: string;
  count: number;
  rows: Row[];
  inspectors: Inspector[];
  photoCount: Map<string, number>;
  kind: "assign" | "review" | "changes";
  emptyText: string;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <span className={`grid size-7 place-items-center rounded-lg ring-1 ${TONE[tone]}`}>{icon}</span>
        <h2 className="text-sm font-bold uppercase tracking-wide text-grey-700">{title}</h2>
        <span className={`rounded-full px-2 py-0.5 text-xs font-bold ring-1 ${TONE[tone]}`}>{count}</span>
        <span className="text-xs text-grey-400">· {hint}</span>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-grey-200 bg-white px-5 py-6 text-sm text-grey-500">{emptyText}</div>
      ) : (
        <div className="rounded-2xl border border-grey-200 bg-white shadow-xs">
          <Table>
            <TableHeader>
              <TableRow className="bg-grey-50/60 [&>th]:px-5 [&>th]:py-3 [&>th]:text-xs [&>th]:font-semibold [&>th]:uppercase [&>th]:tracking-wide [&>th]:text-grey-500">
                <TableHead>Vehicle</TableHead>
                <TableHead>{kind === "review" || kind === "changes" ? "Inspector" : "Assign inspector"}</TableHead>
                <TableHead className="text-right">Photos</TableHead>
                <TableHead className="w-40 text-right">{kind === "changes" ? "Feedback" : kind === "review" ? "Action" : "Updated"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((v) => {
                const photos = photoCount.get(v.id) ?? 0;
                return (
                  <TableRow key={v.id} className="[&>td]:px-5 [&>td]:py-3.5 align-top">
                    <TableCell>
                      <Link href={`/admin/vehicles/${v.id}`} className="block font-medium text-grey-900 hover:text-brand-700">
                        {v.year} {v.make} {v.model}
                      </Link>
                      <p className="text-[11px] text-grey-500">{v.location_city} · {v.vin}</p>
                    </TableCell>

                    <TableCell className="w-56">
                      {kind === "assign" ? (
                        <InspectorAssign
                          vehicleId={v.id}
                          currentInspectorId={v.inspector_id}
                          inspectors={inspectors}
                          compact
                        />
                      ) : (
                        <span className="text-sm text-grey-700">
                          {v.inspector?.full_name ?? v.inspector?.email ?? <span className="text-grey-400">—</span>}
                        </span>
                      )}
                    </TableCell>

                    <TableCell className="text-right">
                      <span className="inline-flex items-center gap-1 rounded-full bg-grey-100 px-2.5 py-0.5 text-[11px] font-semibold text-grey-700">
                        <Camera className="size-3" />
                        {photos}
                      </span>
                    </TableCell>

                    <TableCell className="text-right">
                      {kind === "review" ? (
                        <Link
                          href={`/admin/vehicles/${v.id}`}
                          className="inline-flex items-center gap-1 rounded-md bg-warning-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-warning-700"
                        >
                          Review <ExternalLink className="size-3" />
                        </Link>
                      ) : kind === "changes" ? (
                        <p className="text-left text-[11px] leading-snug text-grey-600">
                          {v.review_notes ? `“${v.review_notes}”` : <span className="text-grey-400">Re-submit pending</span>}
                        </p>
                      ) : (
                        <span className="text-xs text-grey-500">
                          {v.inspection_date ? formatRelativeTime(v.inspection_date) : <span className="text-grey-400">Not inspected</span>}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}

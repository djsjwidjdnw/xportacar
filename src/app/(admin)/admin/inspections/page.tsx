import Link from "next/link";
import { ClipboardCheck, Camera, ExternalLink } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { InspectorAssignSelect } from "@/components/admin/InspectorAssignSelect";
import { createClient } from "@/lib/supabase/server";
import { formatRelativeTime } from "@/lib/utils";

export const metadata = { title: "Inspections · Admin" };

export default async function AdminInspectionsPage() {
  const supabase = await createClient();

  // All vehicles that are in or just out of inspection.  We also include
  // photo counts so the admin can spot vehicles that finished an
  // inspection but didn't have the photos sync.
  const [
    { data: rowsRaw, error },
    { data: inspectorsRaw },
    { data: photoCountsRaw },
  ] = await Promise.all([
    supabase
      .from("vehicles")
      .select(`
        id, year, make, model, vin, status, inspection_date, location_city,
        inspector:profiles!inspector_id ( id, full_name, email )
      `)
      .in("status", ["inspection_scheduled", "inspected", "draft"])
      .order("updated_at", { ascending: false }),
    supabase.from("profiles").select("id, full_name, email").eq("role", "inspector"),
    supabase
      .from("vehicle_photos")
      .select("vehicle_id", { count: "exact", head: false }),
  ]);

  // deno-lint-ignore no-explicit-any
  const rows = (rowsRaw ?? []) as any[];
  const inspectors = (inspectorsRaw ?? []) as { id: string; full_name: string | null; email: string | null }[];

  const photoCount = new Map<string, number>();
  for (const r of (photoCountsRaw ?? []) as { vehicle_id: string }[]) {
    photoCount.set(r.vehicle_id, (photoCount.get(r.vehicle_id) ?? 0) + 1);
  }

  const scheduled = rows.filter((r) => r.status === "inspection_scheduled" || r.status === "draft").length;
  const inspected = rows.filter((r) => r.status === "inspected").length;

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
            {rows.length} vehicles · {scheduled} scheduled · {inspected} inspected
          </p>
        </div>
      </header>

      {error ? (
        <div className="rounded-xl border border-error-200 bg-error-50 p-6 text-error-700">
          {error.message}
        </div>
      ) : rows.length === 0 ? (
        <div className="grid place-items-center rounded-2xl border border-dashed border-grey-300 bg-white p-16 text-center">
          <ClipboardCheck className="mb-3 size-8 text-grey-400" />
          <p className="font-semibold text-grey-900">No vehicles in the inspection pipeline.</p>
          <p className="mt-1 text-sm text-grey-500">Scheduled and inspected vehicles will show up here.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-grey-200 bg-white shadow-xs">
          <Table>
            <TableHeader>
              <TableRow className="bg-grey-50/60 [&>th]:px-5 [&>th]:py-3 [&>th]:text-xs [&>th]:font-semibold [&>th]:uppercase [&>th]:tracking-wide [&>th]:text-grey-500">
                <TableHead>Vehicle</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Inspector</TableHead>
                <TableHead>Inspection date</TableHead>
                <TableHead className="text-right">Photos</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((v) => {
                const photos = photoCount.get(v.id) ?? 0;
                const scheduled = v.status === "inspection_scheduled" || v.status === "draft";
                return (
                  <TableRow key={v.id} className="[&>td]:px-5 [&>td]:py-3.5">
                    <TableCell>
                      <Link href={`/admin/vehicles/${v.id}`} className="block font-medium text-grey-900 hover:text-brand-700">
                        {v.year} {v.make} {v.model}
                      </Link>
                      <p className="text-[11px] text-grey-500">{v.location_city} · {v.vin}</p>
                    </TableCell>
                    <TableCell>
                      <Badge className={
                        scheduled
                          ? "bg-brand-50 text-brand-700 ring-1 ring-brand-100 capitalize"
                          : "bg-success-50 text-success-700 ring-1 ring-success-100"
                      }>
                        {v.status.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="w-56">
                      <InspectorAssignSelect
                        vehicleId={v.id}
                        currentInspectorId={v.inspector?.id ?? null}
                        inspectors={inspectors}
                        compact
                      />
                      {v.inspector?.full_name && (
                        <p className="mt-1 text-[10px] text-grey-500">{v.inspector.full_name}</p>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-grey-600">
                      {v.inspection_date ? formatRelativeTime(v.inspection_date) : (
                        <span className="text-grey-400">Not yet inspected</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="inline-flex items-center gap-1 rounded-full bg-grey-100 px-2.5 py-0.5 text-[11px] font-semibold text-grey-700">
                        <Camera className="size-3" />
                        {photos}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/admin/vehicles/${v.id}`}
                        aria-label="View vehicle"
                        className="grid size-7 place-items-center rounded-md text-grey-400 transition-colors hover:bg-grey-100 hover:text-brand-700"
                      >
                        <ExternalLink className="size-3.5" />
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

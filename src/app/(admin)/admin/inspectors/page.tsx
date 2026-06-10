import Link from "next/link";
import { ChevronRight, HardHat, Check, X } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { createClient } from "@/lib/supabase/server";
import { initials } from "@/lib/utils";
import { DeactivateInspectorButton } from "./DeactivateInspectorButton";

export const metadata = { title: "Inspectors · Admin" };

// A vehicle counts as "completed" once it has progressed past field work.
const COMPLETED_STATUSES = ["inspected", "pending_review", "listed", "in_auction", "sold"] as const;

type InspectorProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  country: string | null;
  created_at: string;
};

type Application = {
  user_id: string;
  city: string | null;
  experience: string | null;
  confirmed_standards: boolean | null;
  id_photo_path: string | null;
  status: string | null;
};

export default async function AdminInspectorsPage() {
  const supabase = await createClient();

  const { data: inspectorsRaw, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, phone, country, created_at")
    .eq("role", "inspector")
    .order("created_at", { ascending: false });

  const inspectors = (inspectorsRaw ?? []) as InspectorProfile[];
  const ids = inspectors.map((i) => i.id);

  // Pull the application detail + the per-inspector vehicle counts in parallel.
  // Counts come back as plain rows we tally in memory (one query each, scoped
  // to just these inspectors) so we never iterate per-inspector queries.
  const [appsRes, assignedRes, completedRes] = ids.length
    ? await Promise.all([
        supabase
          .from("inspector_applications")
          .select("user_id, city, experience, confirmed_standards, id_photo_path, status")
          .in("user_id", ids),
        supabase
          .from("vehicles")
          .select("inspector_id")
          .in("inspector_id", ids),
        supabase
          .from("vehicles")
          .select("inspector_id")
          .in("inspector_id", ids)
          .in("status", COMPLETED_STATUSES as unknown as string[]),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];

  const apps = new Map<string, Application>();
  for (const a of (appsRes.data ?? []) as Application[]) apps.set(a.user_id, a);

  const assignedCount = new Map<string, number>();
  for (const v of (assignedRes.data ?? []) as { inspector_id: string }[]) {
    assignedCount.set(v.inspector_id, (assignedCount.get(v.inspector_id) ?? 0) + 1);
  }
  const completedCount = new Map<string, number>();
  for (const v of (completedRes.data ?? []) as { inspector_id: string }[]) {
    completedCount.set(v.inspector_id, (completedCount.get(v.inspector_id) ?? 0) + 1);
  }

  return (
    <div className="px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-extrabold tracking-tight text-grey-900">
            <span className="grid size-10 place-items-center rounded-xl bg-warning-50 text-warning-700 ring-1 ring-warning-100">
              <HardHat className="size-5" />
            </span>
            Inspectors
          </h1>
          <p className="mt-2 text-grey-600">
            {inspectors.length} active {inspectors.length === 1 ? "inspector" : "inspectors"}
          </p>
        </div>
        <Link
          href="/admin/dashboard"
          className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:text-brand-800"
        >
          Dashboard <ChevronRight className="size-4" />
        </Link>
      </header>

      {error ? (
        <div className="rounded-xl border border-error-200 bg-error-50 p-6 text-error-700">
          {error.message}
        </div>
      ) : inspectors.length === 0 ? (
        <div className="grid place-items-center rounded-2xl border border-dashed border-grey-300 bg-white p-16 text-center">
          <HardHat className="mb-3 size-8 text-grey-400" />
          <p className="font-semibold text-grey-900">No inspectors yet.</p>
          <p className="mt-1 text-sm text-grey-500">
            Inspectors appear here once they sign up or are promoted from the Users page.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-grey-200 bg-white shadow-xs">
          <Table>
            <TableHeader>
              <TableRow className="bg-grey-50/60 [&>th]:px-5 [&>th]:py-3 [&>th]:text-xs [&>th]:font-semibold [&>th]:uppercase [&>th]:tracking-wide [&>th]:text-grey-500">
                <TableHead>Inspector</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Application</TableHead>
                <TableHead>Inspections</TableHead>
                <TableHead>Member since</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {inspectors.map((u) => {
                const app = apps.get(u.id);
                const assigned = assignedCount.get(u.id) ?? 0;
                const completed = completedCount.get(u.id) ?? 0;
                return (
                  <TableRow key={u.id} className="[&>td]:px-5 [&>td]:py-3.5">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="size-9">
                          <AvatarFallback className="bg-warning-100 text-xs font-semibold text-warning-700">
                            {initials(u.full_name ?? u.email ?? "?")}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-grey-900">
                            {u.full_name ?? "—"}
                          </p>
                          <p className="truncate text-[11px] text-grey-500">{u.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-grey-700">
                      {u.phone ?? <span className="text-grey-400">—</span>}
                    </TableCell>
                    <TableCell className="text-sm text-grey-700">
                      {app?.city ? `${app.city}, ` : ""}
                      {u.country ?? (app?.city ? "" : <span className="text-grey-400">—</span>)}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {app ? (
                          <>
                            {app.experience ? (
                              <p className="max-w-[16rem] truncate text-[11px] text-grey-600" title={app.experience}>
                                {app.experience}
                              </p>
                            ) : (
                              <p className="text-[11px] text-grey-400">No experience noted</p>
                            )}
                            <div className="flex flex-wrap items-center gap-1.5">
                              <Flag ok={!!app.confirmed_standards} label="Standards" />
                              <Flag ok={!!app.id_photo_path} label="ID photo" />
                            </div>
                          </>
                        ) : (
                          <span className="text-[11px] text-grey-400">No application on file</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3 text-sm">
                        <span className="font-semibold tabular-nums text-grey-900">{completed}</span>
                        <span className="text-grey-400">/</span>
                        <span className="tabular-nums text-grey-600">{assigned}</span>
                        <span className="text-[10px] uppercase tracking-wide text-grey-400">done / assigned</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-grey-600">
                      {new Date(u.created_at).toLocaleDateString("en-GB", {
                        day: "numeric", month: "short", year: "numeric",
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      <DeactivateInspectorButton userId={u.id} name={u.full_name ?? u.email ?? "this inspector"} />
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

function Flag({ ok, label }: { ok: boolean; label: string }) {
  return (
    <Badge
      className={
        ok
          ? "gap-1 bg-success-50 text-success-700 ring-1 ring-success-100"
          : "gap-1 bg-grey-100 text-grey-500 ring-1 ring-grey-200"
      }
    >
      {ok ? <Check className="size-3" /> : <X className="size-3" />}
      {label}
    </Badge>
  );
}

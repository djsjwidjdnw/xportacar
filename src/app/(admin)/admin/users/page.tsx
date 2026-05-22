import { Users } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { KycActionsInline } from "@/components/admin/KycActionsInline";
import { UserRoleSelect } from "@/components/admin/UserRoleSelect";
import { createClient } from "@/lib/supabase/server";
import { initials } from "@/lib/utils";
import type { Profile } from "@/types";

export const metadata = { title: "Users · Admin" };

const ROLE_STYLE: Record<string, string> = {
  buyer:      "bg-brand-50 text-brand-700 ring-brand-100",
  inspector:  "bg-warning-50 text-warning-700 ring-warning-100",
  admin:      "bg-grey-900 text-white ring-grey-800",
  superadmin: "bg-error-50 text-error-700 ring-error-100",
};

const KYC_STYLE: Record<string, string> = {
  verified: "bg-success-50 text-success-700 ring-success-100",
  pending:  "bg-warning-50 text-warning-700 ring-warning-100",
  rejected: "bg-error-50 text-error-700 ring-error-100",
};

export default async function AdminUsersPage() {
  const supabase = await createClient();

  const { data: rowsRaw, error } = await supabase
    .from("profiles")
    .select(`
      id, full_name, email, role, company_name, country, kyc_status,
      avatar_url, created_at
    `)
    .order("created_at", { ascending: false });

  const rows = (rowsRaw ?? []) as (Profile & {
    company_name: string | null;
    country: string | null;
    created_at: string;
    avatar_url: string | null;
  })[];

  const totalsByRole: Record<string, number> = {};
  const totalsByKyc:  Record<string, number> = {};
  for (const r of rows) {
    totalsByRole[r.role]      = (totalsByRole[r.role] ?? 0) + 1;
    totalsByKyc[r.kyc_status] = (totalsByKyc[r.kyc_status] ?? 0) + 1;
  }

  return (
    <div className="px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
      <Breadcrumbs className="mb-5" items={[{ label: "Users" }]} />
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-extrabold tracking-tight text-grey-900">
            <span className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-brand-100">
              <Users className="size-5" />
            </span>
            Users
          </h1>
          <p className="mt-2 text-grey-600">
            {rows.length} profiles · {totalsByRole.buyer ?? 0} buyers · {totalsByRole.inspector ?? 0} inspectors · {totalsByRole.admin ?? 0} admins
          </p>
        </div>
        <div className="flex gap-2 text-xs">
          <Stat label="Verified"  value={totalsByKyc.verified ?? 0} color="success" />
          <Stat label="Pending"   value={totalsByKyc.pending ?? 0}  color="warning" />
          <Stat label="Rejected"  value={totalsByKyc.rejected ?? 0} color="error" />
        </div>
      </header>

      {error ? (
        <div className="rounded-xl border border-error-200 bg-error-50 p-6 text-error-700">
          {error.message}
        </div>
      ) : (
        <div className="rounded-2xl border border-grey-200 bg-white shadow-xs">
          <Table>
            <TableHeader>
              <TableRow className="bg-grey-50/60 [&>th]:px-5 [&>th]:py-3 [&>th]:text-xs [&>th]:font-semibold [&>th]:uppercase [&>th]:tracking-wide [&>th]:text-grey-500">
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Country</TableHead>
                <TableHead>KYC</TableHead>
                <TableHead>Member since</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="px-5 py-12 text-center text-grey-500">
                    No users yet.
                  </TableCell>
                </TableRow>
              )}
              {rows.map((u) => (
                <TableRow key={u.id} className="[&>td]:px-5 [&>td]:py-3.5">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="size-9">
                        <AvatarImage src={u.avatar_url ?? undefined} />
                        <AvatarFallback className="bg-brand-100 text-xs font-semibold text-brand-700">
                          {initials(u.full_name ?? u.email)}
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
                  <TableCell>
                    <Badge className={`${ROLE_STYLE[u.role] ?? "bg-grey-100 text-grey-700 ring-grey-200"} ring-1 capitalize`}>
                      {u.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-grey-700">
                    {u.company_name ?? <span className="text-grey-400">—</span>}
                  </TableCell>
                  <TableCell className="text-sm text-grey-700">
                    {u.country ?? <span className="text-grey-400">—</span>}
                  </TableCell>
                  <TableCell>
                    <Badge className={`${KYC_STYLE[u.kyc_status] ?? "bg-grey-100 text-grey-700 ring-grey-200"} ring-1 capitalize`}>
                      {u.kyc_status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-grey-600">
                    {new Date(u.created_at).toLocaleDateString("en-GB", {
                      day: "numeric", month: "short", year: "numeric",
                    })}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <KycActionsInline
                        userId={u.id}
                        currentStatus={u.kyc_status as "pending" | "verified" | "rejected"}
                      />
                      <UserRoleSelect
                        userId={u.id}
                        currentRole={u.role as "buyer" | "inspector" | "admin" | "superadmin"}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: "success" | "warning" | "error" }) {
  const cls = {
    success: "border-success-200 bg-success-50 text-success-800",
    warning: "border-warning-200 bg-warning-50 text-warning-800",
    error:   "border-error-200 bg-error-50 text-error-800",
  }[color];
  return (
    <div className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 ${cls}`}>
      <span className="text-[10px] font-bold uppercase tracking-wide">{label}</span>
      <span className="text-sm font-extrabold tabular-nums">{value}</span>
    </div>
  );
}

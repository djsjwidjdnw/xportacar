import Link from "next/link";
import { ChevronRight, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { KycReviewActions } from "@/components/admin/KycReviewActions";
import { createClient } from "@/lib/supabase/server";
import { formatRelativeTime } from "@/lib/utils";

export const metadata = { title: "KYC review · Admin" };

export default async function AdminKycPage() {
  const supabase = await createClient();
  const { data: rowsRaw } = await supabase
    .from("kyc_submissions")
    .select(`
      id, document_type, file_url, status, reviewer_note, created_at,
      user:profiles!user_id (id, full_name, company_name, email, country, kyc_status)
    `)
    .order("created_at", { ascending: false });
  // deno-lint-ignore no-explicit-any
  const rows = (rowsRaw ?? []) as any[];

  return (
    <div className="px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-grey-900">KYC review</h1>
          <p className="mt-1 text-grey-600">
            {rows.filter((r) => r.status === "pending").length} pending · {rows.length} total
          </p>
        </div>
        <Link
          href="/admin/dashboard"
          className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:text-brand-800"
        >
          Dashboard <ChevronRight className="size-4" />
        </Link>
      </header>

      {rows.length === 0 ? (
        <div className="grid place-items-center rounded-2xl border border-dashed border-grey-300 bg-white p-16 text-center">
          <ShieldCheck className="mb-3 size-8 text-grey-400" />
          <p className="font-semibold text-grey-900">No KYC submissions yet.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-grey-200 bg-white shadow-xs">
          <Table>
            <TableHeader>
              <TableRow className="bg-grey-50/60 [&>th]:px-5 [&>th]:py-3 [&>th]:text-xs [&>th]:font-semibold [&>th]:uppercase [&>th]:tracking-wide [&>th]:text-grey-500">
                <TableHead>Buyer</TableHead>
                <TableHead>Document</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead className="text-right">Review</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id} className="[&>td]:px-5 [&>td]:py-3.5">
                  <TableCell>
                    <p className="font-medium text-grey-900">
                      {r.user?.company_name ?? r.user?.full_name ?? "—"}
                    </p>
                    <p className="text-[11px] text-grey-500">
                      {r.user?.email} · {r.user?.country}
                    </p>
                  </TableCell>
                  <TableCell>
                    <a
                      href={r.file_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm font-medium text-brand-700 hover:underline"
                    >
                      {r.document_type.replace(/_/g, " ")}
                    </a>
                    {r.reviewer_note && (
                      <p className="mt-0.5 text-[11px] text-grey-500 italic">Note: {r.reviewer_note}</p>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className={r.status === "approved"
                      ? "bg-success-50 text-success-700 ring-1 ring-success-100"
                      : r.status === "rejected"
                      ? "bg-error-50 text-error-700 ring-1 ring-error-100"
                      : "bg-warning-50 text-warning-700 ring-1 ring-warning-100"}>
                      {r.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-grey-500">
                    {formatRelativeTime(r.created_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <KycReviewActions submissionId={r.id} status={r.status} />
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

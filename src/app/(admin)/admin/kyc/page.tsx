import Link from "next/link";
import { ChevronRight, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { KycReviewActions, type KycReviewDoc } from "@/components/admin/KycReviewActions";
import { createClient } from "@/lib/supabase/server";
import { signKycDoc } from "@/lib/kyc/signDocs";
import { formatRelativeTime } from "@/lib/utils";
import type { KycStatus } from "@/types";

export const metadata = { title: "KYC review · Admin" };

type SubmissionRow = {
  id: string;
  user_id: string;
  document_type: string;
  id_subtype: string | null;
  file_url: string;
  status: string;
  created_at: string;
  user: {
    id: string;
    full_name: string | null;
    company_name: string | null;
    email: string | null;
    country: string | null;
    kyc_status: KycStatus;
    kyc_is_business: boolean | null;
  } | null;
};

type Buyer = {
  userId: string;
  name: string;
  email: string;
  country: string;
  isBusiness: boolean;
  status: KycStatus;
  submittedAt: string;
  docs: KycReviewDoc[];
};

export default async function AdminKycPage() {
  const supabase = await createClient();
  const { data: rowsRaw } = await supabase
    .from("kyc_submissions")
    .select(`
      id, user_id, document_type, id_subtype, file_url, status, created_at,
      user:profiles!user_id (id, full_name, company_name, email, country, kyc_status, kyc_is_business)
    `)
    .order("created_at", { ascending: false });
  const rows = (rowsRaw ?? []) as unknown as SubmissionRow[];

  // Sign every document URL up front (private bucket → short-lived signed URLs).
  const signed = await Promise.all(rows.map((r) => signKycDoc(r.file_url)));

  // Group submissions per buyer.
  const byUser = new Map<string, Buyer>();
  rows.forEach((r, i) => {
    if (!r.user) return;
    const existing = byUser.get(r.user_id);
    const doc: KycReviewDoc = {
      documentType: r.document_type,
      idSubtype: r.id_subtype,
      url: signed[i],
      status: r.status,
    };
    if (existing) {
      existing.docs.push(doc);
    } else {
      byUser.set(r.user_id, {
        userId: r.user_id,
        name: r.user.company_name ?? r.user.full_name ?? "—",
        email: r.user.email ?? "",
        country: r.user.country ?? "",
        isBusiness: !!r.user.kyc_is_business,
        status: r.user.kyc_status,
        submittedAt: r.created_at,
        docs: [doc],
      });
    }
  });

  const buyers = [...byUser.values()].sort((a, b) => {
    if (a.status === "pending" && b.status !== "pending") return -1;
    if (b.status === "pending" && a.status !== "pending") return 1;
    return b.submittedAt.localeCompare(a.submittedAt);
  });
  const pendingCount = buyers.filter((b) => b.status === "pending").length;

  return (
    <div className="px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-grey-900">KYC review</h1>
          <p className="mt-1 text-grey-600">
            {pendingCount} pending · {buyers.length} total
          </p>
        </div>
        <Link
          href="/admin/dashboard"
          className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:text-brand-800"
        >
          Dashboard <ChevronRight className="size-4" />
        </Link>
      </header>

      {buyers.length === 0 ? (
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
                <TableHead className="hidden lg:table-cell">Type</TableHead>
                <TableHead className="hidden xl:table-cell">Documents</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden lg:table-cell">Submitted</TableHead>
                <TableHead className="text-right">Review</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {buyers.map((b) => (
                <TableRow key={b.userId} className="[&>td]:px-5 [&>td]:py-3.5">
                  <TableCell>
                    <p className="max-w-[220px] truncate font-medium text-grey-900">{b.name}</p>
                    <p className="max-w-[220px] truncate text-[11px] text-grey-500">
                      {b.email}{b.country ? ` · ${b.country}` : ""}
                    </p>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <Badge variant="outline" className="border-grey-200 text-grey-600">
                      {b.isBusiness ? "Business" : "Individual"}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden text-xs text-grey-500 xl:table-cell">
                    {b.docs.length} file{b.docs.length === 1 ? "" : "s"}
                  </TableCell>
                  <TableCell>
                    <Badge className={b.status === "verified"
                      ? "bg-success-50 text-success-700 ring-1 ring-success-100"
                      : b.status === "rejected"
                      ? "bg-error-50 text-error-700 ring-1 ring-error-100"
                      : "bg-warning-50 text-warning-700 ring-1 ring-warning-100"}>
                      {b.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden text-xs text-grey-500 lg:table-cell">
                    {formatRelativeTime(b.submittedAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <KycReviewActions
                      userId={b.userId}
                      buyerName={b.name}
                      email={b.email}
                      isBusiness={b.isBusiness}
                      status={b.status}
                      docs={b.docs}
                    />
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

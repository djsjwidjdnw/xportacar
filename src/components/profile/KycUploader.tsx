"use client";

// Trade-licence / ID upload form.  Shows the user's existing submissions
// and their review status.  Used inside the Profile page.

import { useActionState, useEffect, useState } from "react";
import { Upload, FileCheck, FileX, FileClock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";
import {
  submitKycDocumentAction,
  type KycUploadResult,
} from "@/app/(buyer)/profile/kyc-actions";
import { formatRelativeTime } from "@/lib/utils";
import type { KycSubmission } from "@/types";

const initialState: KycUploadResult = { ok: false };

const DOC_TYPES = [
  { value: "trade_license", label: "Trade licence" },
  { value: "id_document",   label: "Government ID" },
  { value: "utility_bill",  label: "Proof of address" },
  { value: "other",         label: "Other" },
] as const;

export function KycUploader({
  submissions,
}: {
  submissions: KycSubmission[];
}) {
  const [state, formAction, isPending] = useActionState(submitKycDocumentAction, initialState);
  const [docType, setDocType] = useState<string>("trade_license");

  useEffect(() => {
    if (state?.ok) toast.ok("Document uploaded", "Our team will review within 1 business day.");
    if (!state?.ok && state?.error) toast.err("Upload failed", state.error);
  }, [state]);

  return (
    <div className="space-y-5">
      <form action={formAction} className="space-y-3">
        <input type="hidden" name="document_type" value={docType} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Select value={docType} onValueChange={(v) => setDocType(v as string)}>
            <SelectTrigger className="h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DOC_TYPES.map((d) => (
                <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="file"
            name="file"
            accept="image/*,.pdf"
            required
            className="h-11 file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-brand-700"
          />
        </div>
        <Button type="submit" size="lg" disabled={isPending} className="h-11">
          <Upload className="size-4" />
          {isPending ? "Uploading…" : "Submit document"}
        </Button>
        <p className="text-[11px] text-grey-500">
          Accepted: JPG, PNG, PDF up to 8 MB. We&apos;ll review and update your status within 24 hours.
        </p>
      </form>

      {submissions.length > 0 && (
        <div className="rounded-lg border border-grey-200">
          <div className="border-b border-grey-100 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-grey-500">
            Your submissions
          </div>
          <ul className="divide-y divide-grey-100">
            {submissions.map((s) => {
              const Icon = s.status === "approved" ? FileCheck
                : s.status === "rejected" ? FileX
                : FileClock;
              return (
                <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div className="flex min-w-0 items-center gap-3">
                    <Icon className={s.status === "approved" ? "size-4 text-success-600"
                      : s.status === "rejected" ? "size-4 text-error-600"
                      : "size-4 text-warning-600"} />
                    <div className="min-w-0">
                      <a href={s.file_url} target="_blank" rel="noreferrer" className="truncate text-sm font-medium text-grey-900 hover:underline">
                        {s.document_type.replace(/_/g, " ")}
                      </a>
                      <p className="text-[11px] text-grey-500">{formatRelativeTime(s.created_at)}</p>
                    </div>
                  </div>
                  <Badge className={s.status === "approved"
                    ? "bg-success-50 text-success-700 ring-1 ring-success-100"
                    : s.status === "rejected"
                    ? "bg-error-50 text-error-700 ring-1 ring-error-100"
                    : "bg-warning-50 text-warning-700 ring-1 ring-warning-100"}>
                    {s.status}
                  </Badge>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

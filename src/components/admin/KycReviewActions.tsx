"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ExternalLink, FileText, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { reviewBuyerKycAction } from "@/app/(buyer)/profile/kyc-actions";
import type { KycStatus } from "@/types";

export type KycReviewDoc = {
  documentType: string;
  idSubtype: string | null;
  url: string | null;
  status: string;
};

// Canonical English reasons — stored on the profile + emailed to the buyer, so
// kept language-stable (the email shell localizes around them).
const COMMON_REASONS = [
  "Document is unclear or unreadable",
  "Document appears expired",
  "Name on document does not match account",
  "Trade licence required for business account",
  "Document type not accepted",
];
const OTHER = "__other__";

const ID_LABELS: Record<string, string> = {
  passport: "Passport",
  drivers_license: "Driver's License",
  national_id: "National ID",
};
const DOC_LABELS: Record<string, string> = {
  id_document: "Personal ID",
  trade_license: "Trade Licence",
  utility_bill: "Utility bill",
  other: "Document",
};
const DOC_ORDER: Record<string, number> = { id_document: 0, trade_license: 1, utility_bill: 2, other: 3 };

function fmtDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function KycReviewActions({
  userId, buyerName, fullName, email, phone, country, registeredAt, isBusiness, status, docs,
}: {
  userId: string;
  buyerName: string;
  fullName: string;
  email: string;
  phone: string;
  country: string;
  registeredAt: string;
  isBusiness: boolean;
  status: KycStatus;
  docs: KycReviewDoc[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reasonChoice, setReasonChoice] = useState<string>(COMMON_REASONS[0]);
  const [reasonText, setReasonText] = useState<string>(COMMON_REASONS[0]);
  const [isPending, startTransition] = useTransition();

  const effectiveReason = reasonChoice === OTHER ? reasonText.trim() : reasonChoice;
  const idType = docs.find((d) => d.documentType === "id_document")?.idSubtype ?? null;
  const orderedDocs = [...docs].sort(
    (a, b) => (DOC_ORDER[a.documentType] ?? 9) - (DOC_ORDER[b.documentType] ?? 9),
  );

  const submit = (decision: "approved" | "rejected") => {
    if (decision === "rejected" && effectiveReason.length < 10) {
      toast.err("Add a reason", "At least 10 characters.");
      return;
    }
    startTransition(async () => {
      const res = await reviewBuyerKycAction({ userId, decision, reason: decision === "rejected" ? effectiveReason : undefined });
      if (!res.ok) {
        toast.err("Couldn't update KYC", res.error);
        return;
      }
      toast.ok(decision === "approved" ? "Buyer verified" : "Submission rejected");
      setOpen(false);
      setRejecting(false);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setRejecting(false); }}>
      <DialogTrigger render={
        <Button size="sm" variant="outline">{status === "pending" ? "Review" : "View"}</Button>
      } />
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Review verification — {buyerName}</DialogTitle>
          <DialogDescription>
            Confirm the documents match the registration details, then approve or reject.
          </DialogDescription>
        </DialogHeader>

        {/* Section 1 — registration info */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 rounded-lg border border-grey-200 bg-grey-50/50 p-4">
          <Info label="Full name" value={fullName || "—"} />
          <Info label="Email" value={email || "—"} />
          <Info label="Phone" value={phone || "—"} />
          <Info label="Country" value={country || "—"} />
          <Info label="Registered" value={fmtDate(registeredAt)} />
          <Info label="Account type" value={isBusiness ? "Business" : "Personal"} />
          <Info label="ID type" value={idType ? ID_LABELS[idType] ?? idType : "—"} />
          <Info label="Status" value={status} />
        </div>

        {/* Section 2 — documents */}
        <div className="space-y-4">
          {orderedDocs.map((d, i) => (
            <DocPreview key={i} doc={d} />
          ))}
        </div>

        {/* Section 3 — reject reason (revealed) */}
        {rejecting && (
          <div className="space-y-2 rounded-lg border border-error-100 bg-error-50/40 p-3">
            <label className="block text-xs font-semibold text-grey-700">Rejection reason</label>
            <select
              value={reasonChoice}
              onChange={(e) => {
                setReasonChoice(e.target.value);
                setReasonText(e.target.value === OTHER ? "" : e.target.value);
              }}
              className="h-10 w-full rounded-lg border border-grey-200 bg-white px-3 text-sm"
            >
              {COMMON_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
              <option value={OTHER}>Other (specify below)</option>
            </select>
            <Textarea
              rows={3}
              value={reasonText}
              onChange={(e) => setReasonText(e.currentTarget.value)}
              placeholder="The buyer sees this reason in their rejection email (min 10 characters)."
            />
          </div>
        )}

        <DialogFooter>
          {!rejecting ? (
            <>
              <Button variant="outline" className="text-error-700 hover:bg-error-50" onClick={() => setRejecting(true)} disabled={isPending}>
                <X className="size-4" /> Reject
              </Button>
              <Button className="bg-success-600 text-white hover:bg-success-700" onClick={() => submit("approved")} disabled={isPending}>
                <Check className="size-4" /> Approve
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setRejecting(false)} disabled={isPending}>Back</Button>
              <Button className="bg-error-600 text-white hover:bg-error-700" onClick={() => submit("rejected")} disabled={isPending || effectiveReason.length < 10}>
                Confirm reject
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-grey-500">{label}</p>
      <p className="truncate text-sm text-grey-900 capitalize">{value}</p>
    </div>
  );
}

function DocPreview({ doc }: { doc: KycReviewDoc }) {
  const label = DOC_LABELS[doc.documentType] ?? doc.documentType.replace(/_/g, " ");
  const sub = doc.documentType === "id_document" && doc.idSubtype
    ? ID_LABELS[doc.idSubtype] ?? doc.idSubtype.replace(/_/g, " ")
    : null;
  const url = doc.url ?? "";
  const isImage = /\.(png|jpe?g)(\?|$)/i.test(url);
  const isPdf = /\.pdf(\?|$)/i.test(url);

  return (
    <div className="rounded-lg border border-grey-200 bg-grey-50/50 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-grey-800">
          {label}{sub ? <span className="ml-1 text-xs font-normal text-grey-500">· {sub}</span> : null}
        </span>
        <Badge className={doc.status === "approved"
          ? "bg-success-50 text-success-700 ring-1 ring-success-100"
          : doc.status === "rejected"
          ? "bg-error-50 text-error-700 ring-1 ring-error-100"
          : "bg-warning-50 text-warning-700 ring-1 ring-warning-100"}>{doc.status}</Badge>
      </div>
      {url ? (
        <>
          <div className="overflow-hidden rounded-md border border-grey-200 bg-white">
            {isImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={url} alt={label} className="mx-auto max-h-[440px] w-full object-contain" />
            ) : isPdf ? (
              <iframe src={url} title={label} className="h-[480px] w-full" />
            ) : (
              <div className="grid h-28 place-items-center text-grey-400"><FileText className="size-6" /></div>
            )}
          </div>
          <a href={url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline">
            Open full size <ExternalLink className="size-3" />
          </a>
        </>
      ) : (
        <p className="text-xs text-grey-400">Preview unavailable.</p>
      )}
    </div>
  );
}

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

export function KycReviewActions({
  userId, buyerName, email, isBusiness, status, docs,
}: {
  userId: string;
  buyerName: string;
  email: string;
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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Review verification — {buyerName}</DialogTitle>
          <DialogDescription>
            {email} · {isBusiness ? "Business account" : "Individual"} · current status:{" "}
            <span className="font-medium">{status}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          {docs.map((d, i) => (
            <DocPreview key={i} doc={d} />
          ))}
        </div>

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

function DocPreview({ doc }: { doc: KycReviewDoc }) {
  const label = doc.documentType.replace(/_/g, " ") + (doc.idSubtype ? ` · ${doc.idSubtype.replace(/_/g, " ")}` : "");
  const url = doc.url ?? "";
  const isImage = /\.(png|jpe?g)(\?|$)/i.test(url);
  const isPdf = /\.pdf(\?|$)/i.test(url);

  return (
    <div className="rounded-lg border border-grey-200 bg-grey-50/50 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold capitalize text-grey-700">{label}</span>
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
              <img src={url} alt={label} className="max-h-48 w-full object-contain" />
            ) : isPdf ? (
              <iframe src={url} title={label} className="h-48 w-full" />
            ) : (
              <div className="grid h-24 place-items-center text-grey-400"><FileText className="size-6" /></div>
            )}
          </div>
          <a href={url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline">
            Open <ExternalLink className="size-3" />
          </a>
        </>
      ) : (
        <p className="text-xs text-grey-400">Preview unavailable.</p>
      )}
    </div>
  );
}

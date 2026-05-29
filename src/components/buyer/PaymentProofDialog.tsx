"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, FileUp, Paperclip, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader,
  DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { submitPaymentProofAction } from "@/app/(buyer)/auction/[id]/won/actions";

const MAX_FILES = 5;
const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = /\.(pdf|png|jpe?g)$/i;

function fmtSize(b: number) {
  return b < 1024 * 1024 ? `${Math.round(b / 1024)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`;
}

export function PaymentProofDialog({ invoiceId }: { invoiceId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const incoming = Array.from(list);
    const next: File[] = [...files];
    for (const f of incoming) {
      if (!ALLOWED.test(f.name)) { toast.err("Unsupported file", `${f.name}: only PDF, PNG, JPG allowed.`); continue; }
      if (f.size > MAX_BYTES) { toast.err("File too large", `${f.name} is larger than 10MB.`); continue; }
      if (next.length >= MAX_FILES) { toast.err("Too many files", `Attach at most ${MAX_FILES} files.`); break; }
      if (!next.some((e) => e.name === f.name && e.size === f.size)) next.push(f);
    }
    setFiles(next);
    if (inputRef.current) inputRef.current.value = "";
  };

  const removeFile = (i: number) => setFiles((arr) => arr.filter((_, idx) => idx !== i));

  const submit = () => {
    if (files.length === 0) { toast.err("Attach proof", "Add at least one payment proof file."); return; }
    startTransition(async () => {
      const fd = new FormData();
      fd.set("invoiceId", invoiceId);
      fd.set("note", note);
      for (const f of files) fd.append("files", f);
      const res = await submitPaymentProofAction(fd);
      if (!res.ok) { toast.err("Couldn't submit", res.error ?? "Try again."); return; }
      toast.ok("Payment proof submitted", "Our team will verify receipt. You now have 5 working days to complete the wire.");
      setOpen(false);
      setFiles([]);
      setNote("");
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={
        <Button className="mt-4 h-11">
          <CheckCircle2 className="size-4" />
          Confirm payment
        </Button>
      } />
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Confirm payment &amp; upload proof</DialogTitle>
          <DialogDescription>
            Upload your transfer receipt (PDF, PNG or JPG — up to {MAX_FILES} files, 10MB each).
            Submitting confirms your intent to pay and starts the 5 working day window.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
            className="hidden"
            onChange={(e) => addFiles(e.currentTarget.files)}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-grey-300 bg-grey-50 px-4 py-6 text-sm text-grey-600 hover:border-brand-400 hover:bg-brand-50/40"
          >
            <FileUp className="size-6 text-brand-600" />
            <span className="font-semibold text-grey-800">Choose files</span>
            <span className="text-xs">PDF, PNG, JPG · max {MAX_FILES} files · 10MB each</span>
          </button>

          {files.length > 0 && (
            <ul className="space-y-1.5">
              {files.map((f, i) => (
                <li key={`${f.name}-${i}`} className="flex items-center gap-2 rounded-lg border border-grey-200 bg-white px-3 py-2 text-sm">
                  <Paperclip className="size-4 shrink-0 text-grey-400" />
                  <span className="min-w-0 flex-1 truncate text-grey-800">{f.name}</span>
                  <span className="shrink-0 text-xs text-grey-500">{fmtSize(f.size)}</span>
                  <button type="button" onClick={() => removeFile(i)} aria-label="Remove" className="shrink-0 text-grey-400 hover:text-error-600">
                    <X className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-grey-700">Note (optional)</span>
            <Textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.currentTarget.value)}
              placeholder="Reference number, transfer details, etc."
            />
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
          <Button onClick={submit} disabled={pending || files.length === 0}>
            {pending ? "Submitting…" : "Submit proof"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

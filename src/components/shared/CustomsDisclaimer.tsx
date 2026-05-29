import { AlertTriangle } from "lucide-react";

import { cn } from "@/lib/utils";

export const CUSTOMS_DISCLAIMER_TEXT =
  "All import costs including customs duties and VAT are the responsibility of the buyer and are not included in our fees or shipping costs.";

// Prominent (not fine-print) customs/VAT disclaimer shown on shipping options
// and every invoice. Red + bold by design.
export function CustomsDisclaimer({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-lg border border-error-200 bg-error-50 px-4 py-3",
        className,
      )}
      role="note"
    >
      <AlertTriangle className="mt-0.5 size-5 shrink-0 text-error-600" />
      <p className="min-w-0 flex-1 break-words text-sm font-bold text-error-700">{CUSTOMS_DISCLAIMER_TEXT}</p>
    </div>
  );
}

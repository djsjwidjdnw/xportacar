"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { deleteMyAccountAction } from "@/app/(buyer)/profile/actions";
import { useTranslations } from "@/i18n/provider";

const CONFIRM_WORD = "DELETE";

export function DeleteAccountSection() {
  const t = useTranslations("deleteAccount");
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const canDelete = confirmText === CONFIRM_WORD && !isPending;

  function handleOpenChange(next: boolean) {
    if (isPending) return; // don't allow closing mid-delete
    setOpen(next);
    if (!next) {
      setConfirmText("");
      setError(null);
    }
  }

  function handleDelete() {
    if (!canDelete) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteMyAccountAction();
      if (res.ok) {
        toast.ok(t("success"));
        router.push("/login");
        return;
      }
      setError(res.error ?? t("failed"));
    });
  }

  return (
    <section className="mt-6 rounded-2xl border border-error-200 bg-error-50/40 p-6">
      <h3 className="flex items-center gap-2 text-lg font-bold text-error-700">
        <AlertTriangle className="size-5 text-error-600" />
        {t("title")}
      </h3>
      <p className="mt-1 text-sm text-grey-600">{t("warning")}</p>

      <div className="mt-5">
        <Button
          type="button"
          variant="destructive"
          size="lg"
          className="h-11 px-6"
          onClick={() => setOpen(true)}
        >
          <Trash2 className="size-4" />
          {t("button")}
        </Button>
      </div>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-error-700">
              <AlertTriangle className="size-5 text-error-600" />
              {t("title")}
            </DialogTitle>
            <DialogDescription>{t("warning")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <p className="text-sm font-semibold text-grey-700">{t("loseIntro")}</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-grey-600">
                <li>{t("loseBids")}</li>
                <li>{t("loseInvoices")}</li>
              </ul>
            </div>

            <p className="rounded-md bg-error-50 px-3 py-2 text-sm font-medium text-error-700">
              {t("cannotUndo")}
            </p>

            <div className="space-y-1.5">
              <Label htmlFor="delete-confirm">{t("typeToConfirm")}</Label>
              <Input
                id="delete-confirm"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={CONFIRM_WORD}
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                disabled={isPending}
                className="h-11"
              />
            </div>

            {error && (
              <p className="rounded-md bg-error-50 px-3 py-2 text-sm text-error-700">{error}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="h-11 px-6"
              onClick={() => handleOpenChange(false)}
              disabled={isPending}
            >
              {t("cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="h-11 px-6"
              onClick={handleDelete}
              disabled={!canDelete}
            >
              {isPending ? t("deleting") : t("confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

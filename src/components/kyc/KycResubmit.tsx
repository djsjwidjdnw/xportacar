"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileCheck2, UploadCloud } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";
import { useTranslations } from "@/i18n/provider";
import type { KycIdSubtype } from "@/types";

const ID_TYPES: { value: KycIdSubtype; key: string }[] = [
  { value: "passport", key: "idTypePassport" },
  { value: "drivers_license", key: "idTypeDriversLicense" },
  { value: "national_id", key: "idTypeNationalId" },
];
const FILE_ACCEPT = "application/pdf,image/png,image/jpeg,.pdf,.png,.jpg,.jpeg";

// Signed-in KYC (re)submission. POSTs to /api/kyc/upload using the cookie
// session (same-origin), so no token handling is needed here.
export function KycResubmit({ defaultBusiness = false }: { defaultBusiness?: boolean }) {
  const t = useTranslations("auth");
  const router = useRouter();

  const [isBusiness, setIsBusiness] = useState(defaultBusiness);
  const [idSubtype, setIdSubtype] = useState<KycIdSubtype | "">("");
  const [idName, setIdName] = useState<string | null>(null);
  const [tlName, setTlName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const idRef = useRef<HTMLInputElement>(null);
  const tlRef = useRef<HTMLInputElement>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const idFile = idRef.current?.files?.[0] ?? null;
    const tlFile = tlRef.current?.files?.[0] ?? null;
    if (!idSubtype) return toast.err(t("needIdType"));
    if (!idFile) return toast.err(t("needPersonalId"));
    if (isBusiness && !tlFile) return toast.err(t("needTradeLicense"));

    setBusy(true);
    const fd = new FormData();
    fd.set("personal_id", idFile);
    fd.set("id_subtype", idSubtype);
    fd.set("is_business", String(isBusiness));
    if (tlFile) fd.set("trade_license", tlFile);
    try {
      const r = await fetch("/api/kyc/upload", { method: "POST", body: fd });
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (r.ok && j.ok) {
        toast.ok(t("registerDoneTitle"));
        router.refresh();
      } else {
        toast.err(j.error ?? t("uploadFailedAfterSignup"));
      }
    } catch {
      toast.err(t("uploadFailedAfterSignup"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="flex gap-2">
        {[{ v: false, l: t("no") }, { v: true, l: t("yes") }].map((opt) => (
          <button
            key={String(opt.v)}
            type="button"
            onClick={() => setIsBusiness(opt.v)}
            className={`h-10 flex-1 rounded-lg border text-sm font-semibold transition ${
              isBusiness === opt.v
                ? "border-brand-600 bg-brand-50 text-brand-700"
                : "border-grey-200 bg-white text-grey-600 hover:border-grey-300"
            }`}
          >
            {t("isBusinessQ")}: {opt.l}
          </button>
        ))}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="resubmitIdType">{t("idType")}</Label>
        <select
          id="resubmitIdType"
          value={idSubtype}
          onChange={(e) => setIdSubtype(e.target.value as KycIdSubtype)}
          required
          className="h-11 w-full rounded-lg border border-grey-200 bg-white px-3 text-sm text-grey-900"
        >
          <option value="" disabled>—</option>
          {ID_TYPES.map((o) => (
            <option key={o.value} value={o.value}>{t(o.key)}</option>
          ))}
        </select>
      </div>

      <FilePicker label={t("personalIdLabel")} hint={t("personalIdHint")} chooseLabel={t("chooseFile")} inputRef={idRef} fileName={idName} onPick={() => setIdName(idRef.current?.files?.[0]?.name ?? null)} />
      {isBusiness && (
        <FilePicker label={t("tradeLicenseLabel")} hint={t("tradeLicenseHint")} chooseLabel={t("chooseFile")} inputRef={tlRef} fileName={tlName} onPick={() => setTlName(tlRef.current?.files?.[0]?.name ?? null)} />
      )}

      <Button type="submit" disabled={busy} className="h-11 w-full">
        {busy ? t("uploadingDocs") : t("resubmitCta")}
      </Button>
    </form>
  );
}

function FilePicker({
  label, hint, chooseLabel, inputRef, fileName, onPick,
}: {
  label: string;
  hint: string;
  chooseLabel: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  fileName: string | null;
  onPick: () => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-grey-300 bg-white px-3 py-2.5 text-sm text-grey-600 hover:border-brand-400">
        {fileName ? <FileCheck2 className="h-5 w-5 shrink-0 text-success-600" /> : <UploadCloud className="h-5 w-5 shrink-0 text-grey-400" />}
        <span className="truncate">{fileName ?? chooseLabel}</span>
        <input ref={inputRef} type="file" accept={FILE_ACCEPT} onChange={onPick} className="sr-only" />
      </label>
      <p className="text-xs text-grey-500">{hint}</p>
    </div>
  );
}

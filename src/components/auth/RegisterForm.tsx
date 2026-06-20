"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, FileCheck2, MailCheck, UploadCloud } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslations } from "@/i18n/provider";
import { signUpAction } from "@/app/(auth)/actions";
import type { KycIdSubtype } from "@/types";

type DoneState = { needsConfirm: boolean; uploadOk: boolean };

const ID_TYPES: { value: KycIdSubtype; key: string }[] = [
  { value: "passport", key: "idTypePassport" },
  { value: "drivers_license", key: "idTypeDriversLicense" },
  { value: "national_id", key: "idTypeNationalId" },
];

const FILE_ACCEPT = "application/pdf,image/png,image/jpeg,.pdf,.png,.jpg,.jpeg";

export function RegisterForm() {
  const t = useTranslations("auth");
  const tk = useTranslations("kyc");
  const router = useRouter();

  const [showPw, setShowPw] = useState(false);
  const [isBusiness, setIsBusiness] = useState(false);
  const [idSubtype, setIdSubtype] = useState<KycIdSubtype | "">("");
  const [idName, setIdName] = useState<string | null>(null);
  const [tlName, setTlName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<"idle" | "creating" | "uploading">("idle");
  const [done, setDone] = useState<DoneState | null>(null);

  const idRef = useRef<HTMLInputElement>(null);
  const tlRef = useRef<HTMLInputElement>(null);
  const pending = phase !== "idle";

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const idFile = idRef.current?.files?.[0] ?? null;
    const tlFile = tlRef.current?.files?.[0] ?? null;
    const companyName = String(fd.get("companyName") ?? "").trim();

    if (!idSubtype) return setError(t("needIdType"));
    if (!idFile) return setError(t("needPersonalId"));
    if (isBusiness && !companyName) return setError(t("needCompanyName"));
    if (isBusiness && !tlFile) return setError(t("needTradeLicense"));

    setPhase("creating");
    const signupFd = new FormData();
    for (const k of ["email", "password", "fullName", "companyName", "country"]) {
      signupFd.set(k, String(fd.get(k) ?? ""));
    }
    signupFd.set("isBusiness", String(isBusiness));

    let res;
    try {
      res = await signUpAction(undefined, signupFd);
    } catch {
      setPhase("idle");
      return setError("Something went wrong. Please try again.");
    }
    if (!res.ok) {
      setPhase("idle");
      return setError(res.error ?? "Could not create your account.");
    }

    // Upload documents (session-free via the one-time token).
    setPhase("uploading");
    const upFd = new FormData();
    if (res.uploadToken) upFd.set("token", res.uploadToken);
    upFd.set("personal_id", idFile);
    upFd.set("id_subtype", idSubtype);
    upFd.set("is_business", String(isBusiness));
    if (tlFile) upFd.set("trade_license", tlFile);

    let uploadOk = false;
    try {
      const r = await fetch("/api/kyc/upload", { method: "POST", body: upFd });
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      uploadOk = !!(r.ok && j.ok);
      if (!uploadOk) setError(j.error ?? t("uploadFailedAfterSignup"));
    } catch {
      setError(t("uploadFailedAfterSignup"));
    }

    setPhase("idle");
    if (!res.needsConfirm && uploadOk) {
      router.push("/pending-verification");
      return;
    }
    setDone({ needsConfirm: !!res.needsConfirm, uploadOk });
  }

  if (done) {
    return (
      <div className="space-y-4 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success-50 text-success-600">
          {done.needsConfirm ? <MailCheck className="h-6 w-6" /> : <FileCheck2 className="h-6 w-6" />}
        </div>
        <h2 className="text-lg font-bold text-grey-900">
          {done.needsConfirm ? t("registerDoneConfirmTitle") : t("registerDoneTitle")}
        </h2>
        <p className="text-sm text-grey-600">
          {done.needsConfirm ? t("registerDoneConfirmBody") : tk("pendingBody")}
        </p>
        {!done.uploadOk && (
          <p className="rounded-md bg-warning-50 px-3 py-2 text-sm text-warning-700">
            {t("uploadFailedAfterSignup")}
          </p>
        )}
        <Button onClick={() => router.push("/login")} size="lg" className="h-11 w-full text-base">
          {tk("goToSignIn")}
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="fullName">{t("fullName")}</Label>
        <Input id="fullName" name="fullName" required autoComplete="name" placeholder="Klaus Weber" className="h-11" />
      </div>

      {/* Account type */}
      <div className="space-y-1.5">
        <Label>{t("isBusinessQ")}</Label>
        <div className="flex gap-2">
          {[{ v: false, l: t("no") }, { v: true, l: t("yes") }].map((opt) => (
            <button
              key={String(opt.v)}
              type="button"
              onClick={() => setIsBusiness(opt.v)}
              className={`h-11 flex-1 rounded-lg border text-sm font-semibold transition ${
                isBusiness === opt.v
                  ? "border-brand-600 bg-brand-50 text-brand-700"
                  : "border-grey-200 bg-white text-grey-600 hover:border-grey-300"
              }`}
            >
              {opt.l}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="companyName">{t("companyName")}</Label>
        <Input
          id="companyName"
          name="companyName"
          required={isBusiness}
          autoComplete="organization"
          placeholder="AutoHaus Weber GmbH"
          className="h-11"
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="country">{t("country")}</Label>
          <Input id="country" name="country" autoComplete="country-name" placeholder="Germany" className="h-11" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">{t("email")}</Label>
          <Input id="email" name="email" type="email" required autoComplete="email" placeholder="you@company.com" className="h-11" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">{t("password")}</Label>
        <div className="relative">
          <Input id="password" name="password" type={showPw ? "text" : "password"} required minLength={8} autoComplete="new-password" className="h-11 pr-11" />
          <button
            type="button"
            onClick={() => setShowPw((v) => !v)}
            aria-label={showPw ? t("hidePassword") : t("showPassword")}
            className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center text-grey-500 hover:text-grey-700"
          >
            {showPw ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </div>
        <p className="text-xs text-grey-500">{t("passwordMin8")}</p>
      </div>

      {/* KYC documents */}
      <div className="space-y-4 rounded-xl border border-grey-200 bg-grey-50/60 p-4">
        <div>
          <h3 className="text-sm font-bold text-grey-900">{t("kycSectionTitle")}</h3>
          <p className="mt-0.5 text-xs text-grey-500">{t("kycSectionHint")}</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="idType">{t("idType")}</Label>
          <select
            id="idType"
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

        <FilePicker
          label={t("personalIdLabel")}
          hint={t("personalIdHint")}
          chooseLabel={t("chooseFile")}
          inputRef={idRef}
          fileName={idName}
          onPick={() => setIdName(idRef.current?.files?.[0]?.name ?? null)}
        />

        {isBusiness && (
          <FilePicker
            label={t("tradeLicenseLabel")}
            hint={t("tradeLicenseHint")}
            chooseLabel={t("chooseFile")}
            inputRef={tlRef}
            fileName={tlName}
            onPick={() => setTlName(tlRef.current?.files?.[0]?.name ?? null)}
          />
        )}
      </div>

      {error && <p className="rounded-md bg-error-50 px-3 py-2 text-sm text-error-700">{error}</p>}

      {pending && (
        <div className="space-y-1.5">
          <div className="h-1 w-full overflow-hidden rounded-full bg-grey-100">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-brand-600" />
          </div>
          <p className="text-center text-xs text-grey-500">
            {phase === "creating" ? t("creatingAccount") : t("uploadingDocs")}
          </p>
        </div>
      )}

      <Button type="submit" size="lg" disabled={pending} className="h-11 w-full text-base">
        {pending ? "…" : t("submitRegister")}
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

"use client";

// Change-password for a signed-in user. Re-verifies the current password
// (signInWithPassword for the same user — refreshes, doesn't disrupt the
// session) before calling updateUser({ password }).

import { useState } from "react";
import { Eye, EyeOff, KeyRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { useTranslations } from "@/i18n/provider";

export function ChangePasswordSection({ email }: { email: string }) {
  const t = useTranslations("auth");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setDone(false);
    if (next.length < 8) { setError(t("passwordTooShort")); return; }
    if (next !== confirm) { setError(t("passwordsNoMatch")); return; }
    setSaving(true);
    const supabase = createClient();

    // 1) Re-verify the current password.
    const { error: reauthErr } = await supabase.auth.signInWithPassword({ email, password: current });
    if (reauthErr) { setSaving(false); setError(t("currentPasswordWrong")); return; }

    // 2) Set the new password.
    const { error: updErr } = await supabase.auth.updateUser({ password: next });
    setSaving(false);
    if (updErr) { setError(updErr.message); return; }
    setCurrent(""); setNext(""); setConfirm("");
    setDone(true);
  };

  return (
    <section className="mt-6 rounded-2xl border border-grey-200 bg-white p-6 shadow-xs">
      <h3 className="mb-1 flex items-center gap-2 text-lg font-bold text-grey-900">
        <KeyRound className="size-5 text-grey-500" />
        {t("changePassword")}
      </h3>
      <p className="mb-5 text-sm text-grey-600">{t("changePasswordSubtitle")}</p>

      <form onSubmit={submit} className="max-w-md space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="cur">{t("currentPassword")}</Label>
          <Input id="cur" type="password" required autoComplete="current-password"
            value={current} onChange={(e) => setCurrent(e.target.value)} className="h-11" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="new">{t("newPassword")}</Label>
          <div className="relative">
            <Input id="new" type={showPw ? "text" : "password"} required autoComplete="new-password"
              value={next} onChange={(e) => setNext(e.target.value)} className="h-11 pr-11" />
            <button type="button" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? t("hidePassword") : t("showPassword")}
              className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center text-grey-500 hover:text-grey-700">
              {showPw ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
          <p className="text-xs text-grey-500">{t("passwordMin8")}</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="conf">{t("confirmNewPassword")}</Label>
          <Input id="conf" type={showPw ? "text" : "password"} required autoComplete="new-password"
            value={confirm} onChange={(e) => setConfirm(e.target.value)} className="h-11" />
        </div>

        {error && <p className="rounded-md bg-error-50 px-3 py-2 text-sm text-error-700">{error}</p>}
        {done && <p className="rounded-md bg-success-50 px-3 py-2 text-sm text-success-700">{t("passwordChanged")}</p>}

        <Button type="submit" disabled={saving} className="h-11">
          {saving ? "…" : t("changePassword")}
        </Button>
      </form>
    </section>
  );
}

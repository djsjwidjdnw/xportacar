"use client";

// Password-recovery callback. Reached from the email reset link for ALL three
// apps. Establishes the recovery session two ways:
//   • web-initiated (PKCE): link carries ?code → exchangeCodeForSession.
//   • mobile-initiated (implicit): link carries #access_token&type=recovery →
//     the browser client auto-detects it (detectSessionInUrl) / PASSWORD_RECOVERY.
// Once a session exists, the user sets a new password via updateUser({ password }).

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { useTranslations } from "@/i18n/provider";

export default function ResetPasswordCallbackPage() {
  const t = useTranslations("auth");
  const router = useRouter();
  const [status, setStatus] = useState<"checking" | "ready" | "invalid" | "done">("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let settled = false;

    // Catch the implicit-flow / recovery session the client picks up from the URL.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN")) {
        settled = true;
        setStatus("ready");
      }
    });

    (async () => {
      // PKCE: exchange the ?code for a session (verifier is in the browser cookie).
      const code = new URLSearchParams(window.location.search).get("code");
      if (code) {
        try { await supabase.auth.exchangeCodeForSession(code); } catch { /* fall through */ }
      }
      const { data } = await supabase.auth.getSession();
      if (settled) return;
      setStatus(data.session ? "ready" : "invalid");
    })();

    return () => sub.subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) { setError(t("passwordTooShort")); return; }
    if (password !== confirm) { setError(t("passwordsNoMatch")); return; }
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (error) { setError(error.message); return; }
    setStatus("done");
    await supabase.auth.signOut();
    setTimeout(() => router.push("/login?reset=1"), 1200);
  };

  return (
    <div className="rounded-2xl border border-grey-200 bg-white p-8 shadow-sm">
      {status === "checking" && (
        <p className="py-6 text-center text-sm text-grey-600">…</p>
      )}

      {status === "invalid" && (
        <div className="text-center">
          <h1 className="text-2xl font-extrabold text-grey-900">{t("resetTitle")}</h1>
          <p className="mt-2 text-sm text-error-700">{t("recoveryInvalid")}</p>
          <Link href="/reset-password" className="mt-6 inline-block text-sm font-semibold text-brand-700 hover:underline">
            {t("requestNewLink")}
          </Link>
        </div>
      )}

      {status === "done" && (
        <div className="text-center">
          <h1 className="text-2xl font-extrabold text-grey-900">{t("passwordUpdatedTitle")}</h1>
          <p className="mt-2 text-sm text-grey-600">{t("passwordUpdatedBody")}</p>
        </div>
      )}

      {status === "ready" && (
        <>
          <header className="mb-7 text-center">
            <h1 className="text-2xl font-extrabold text-grey-900">{t("setNewPasswordTitle")}</h1>
            <p className="mt-2 text-sm text-grey-600">{t("setNewPasswordSubtitle")}</p>
          </header>
          <form onSubmit={submit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="pw">{t("newPassword")}</Label>
              <div className="relative">
                <Input
                  id="pw" type={showPw ? "text" : "password"} required autoComplete="new-password"
                  value={password} onChange={(e) => setPassword(e.target.value)} className="h-11 pr-11"
                />
                <button type="button" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? t("hidePassword") : t("showPassword")}
                  className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center text-grey-500 hover:text-grey-700">
                  {showPw ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pw2">{t("confirmNewPassword")}</Label>
              <Input
                id="pw2" type={showPw ? "text" : "password"} required autoComplete="new-password"
                value={confirm} onChange={(e) => setConfirm(e.target.value)} className="h-11"
              />
            </div>
            {error && <p className="rounded-md bg-error-50 px-3 py-2 text-sm text-error-700">{error}</p>}
            <Button type="submit" size="lg" disabled={saving} className="h-11 w-full text-base">
              {saving ? "…" : t("setNewPassword")}
            </Button>
          </form>
        </>
      )}
    </div>
  );
}

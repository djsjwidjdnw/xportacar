"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslations } from "@/i18n/provider";
import { signInAction, type AuthFormState } from "@/app/(auth)/actions";

const initialState: AuthFormState = { ok: false };

export function LoginForm({ next }: { next: string }) {
  const t = useTranslations("auth");
  const [state, formAction, isPending] = useActionState(signInAction, initialState);
  const [showPw, setShowPw] = useState(false);

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="next" value={next} />

      <div className="space-y-1.5">
        <Label htmlFor="email">{t("email")}</Label>
        <Input id="email" name="email" type="email" required autoComplete="email" placeholder="you@company.com" className="h-11" />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">{t("password")}</Label>
          <Link href="/reset-password" className="text-xs font-medium text-brand-700 hover:underline">{t("forgotPassword")}</Link>
        </div>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPw ? "text" : "password"}
            required
            autoComplete="current-password"
            className="h-11 pr-11"
          />
          <button
            type="button"
            onClick={() => setShowPw((v) => !v)}
            aria-label={showPw ? t("hidePassword") : t("showPassword")}
            className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center text-grey-500 hover:text-grey-700"
          >
            {showPw ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {state?.error && (
        <p className="rounded-md bg-error-50 px-3 py-2 text-sm text-error-700">
          {state.error}
        </p>
      )}

      <Button type="submit" size="lg" disabled={isPending} className="h-11 w-full text-base">
        {isPending ? "…" : t("submitLogin")}
      </Button>
    </form>
  );
}

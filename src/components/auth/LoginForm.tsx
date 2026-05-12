"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslations } from "@/i18n/provider";
import { signInAction, type AuthFormState } from "@/app/(auth)/actions";

const initialState: AuthFormState = { ok: false };

export function LoginForm({ next }: { next: string }) {
  const t = useTranslations("auth");
  const [state, formAction, isPending] = useActionState(signInAction, initialState);

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
          <a href="#" className="text-xs font-medium text-brand-700 hover:underline">{t("forgotPassword")}</a>
        </div>
        <Input id="password" name="password" type="password" required autoComplete="current-password" className="h-11" />
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

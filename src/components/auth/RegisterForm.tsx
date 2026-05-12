"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslations } from "@/i18n/provider";
import { signUpAction, type AuthFormState } from "@/app/(auth)/actions";

const initialState: AuthFormState = { ok: false };

export function RegisterForm() {
  const t = useTranslations("auth");
  const [state, formAction, isPending] = useActionState(signUpAction, initialState);

  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="fullName">{t("fullName")}</Label>
        <Input id="fullName" name="fullName" required autoComplete="name" placeholder="Klaus Weber" className="h-11" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="companyName">{t("companyName")}</Label>
        <Input id="companyName" name="companyName" autoComplete="organization" placeholder="AutoHaus Weber GmbH" className="h-11" />
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
        <Input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" className="h-11" />
        <p className="text-xs text-grey-500">At least 8 characters.</p>
      </div>

      {state?.error && (
        <p className="rounded-md bg-error-50 px-3 py-2 text-sm text-error-700">{state.error}</p>
      )}
      {state?.ok && state.message && (
        <p className="rounded-md bg-success-50 px-3 py-2 text-sm text-success-700">{state.message}</p>
      )}

      <Button type="submit" size="lg" disabled={isPending} className="h-11 w-full text-base">
        {isPending ? "…" : t("submitRegister")}
      </Button>
    </form>
  );
}

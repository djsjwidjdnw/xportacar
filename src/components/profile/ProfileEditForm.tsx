"use client";

import { useActionState, useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import {
  updateProfileAction,
  type ProfileFormState,
} from "@/app/(buyer)/profile/actions";
import { LOCALE_NAMES, SUPPORTED_LOCALES, type Locale } from "@/lib/constants";
import type { Profile } from "@/types";

const initialState: ProfileFormState = { ok: false };

export function ProfileEditForm({ profile }: { profile: Profile }) {
  const [state, formAction, isPending] = useActionState(updateProfileAction, initialState);

  // Surface action result via toast.
  useEffect(() => {
    if (state?.ok && state.message) toast.ok("Profile saved", state.message);
    if (!state?.ok && state?.error) toast.err("Couldn't save profile", state.error);
  }, [state]);

  return (
    <form action={formAction} className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Full name" required>
          <Input name="full_name" defaultValue={profile.full_name ?? ""} required className="h-11" placeholder="Klaus Weber" autoComplete="name" />
        </Field>
        <Field label="Email">
          <Input value={profile.email ?? ""} disabled className="h-11 bg-grey-50" />
        </Field>
        <Field label="Company name">
          <Input name="company_name" defaultValue={profile.company_name ?? ""} className="h-11" placeholder="AutoHaus Weber GmbH" autoComplete="organization" />
        </Field>
        <Field label="Company registration">
          <Input name="company_registration" defaultValue={profile.company_registration ?? ""} className="h-11" placeholder="DE123456789" />
        </Field>
        <Field label="Phone">
          <Input name="phone" defaultValue={profile.phone ?? ""} className="h-11" placeholder="+49 30 12345678" autoComplete="tel" />
        </Field>
        <Field label="Country">
          <Input name="country" defaultValue={profile.country ?? ""} className="h-11" placeholder="Germany" autoComplete="country-name" />
        </Field>
        <Field label="Avatar URL">
          <Input name="avatar_url" defaultValue={profile.avatar_url ?? ""} className="h-11" placeholder="https://…" />
        </Field>
        <Field label="Language">
          <input type="hidden" name="language" value={profile.language ?? "en"} id="lang-hidden" />
          <LanguageSelect defaultValue={(profile.language as Locale) ?? "en"} />
        </Field>
      </div>

      {state?.error && (
        <p className="rounded-md bg-error-50 px-3 py-2 text-sm text-error-700">{state.error}</p>
      )}
      {state?.ok && state.message && (
        <p className="rounded-md bg-success-50 px-3 py-2 text-sm text-success-700">{state.message}</p>
      )}

      <div className="flex justify-end gap-2">
        <Button type="submit" size="lg" disabled={isPending} className="h-11 px-6">
          {isPending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>
        {label} {required && <span className="text-error-600">*</span>}
      </Label>
      {children}
    </div>
  );
}

function LanguageSelect({ defaultValue }: { defaultValue: Locale }) {
  return (
    <Select
      defaultValue={defaultValue}
      onValueChange={(v) => {
        const input = document.getElementById("lang-hidden") as HTMLInputElement | null;
        if (input) input.value = v as string;
      }}
    >
      <SelectTrigger className="h-11 w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SUPPORTED_LOCALES.map((l) => (
          <SelectItem key={l} value={l}>
            {LOCALE_NAMES[l].flag} {LOCALE_NAMES[l].name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

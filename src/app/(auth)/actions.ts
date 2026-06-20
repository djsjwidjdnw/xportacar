"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { registerBuyer } from "@/lib/auth/registerBuyer";
import { resolveLocale } from "@/i18n/server";

export type AuthFormState = {
  ok: boolean;
  error?: string;
  message?: string;
  // Set after a successful signUp so the client can run the KYC document
  // upload step (session-free) and then route the buyer onward.
  needsConfirm?: boolean;   // true when email confirmation is required (no session yet)
  uploadToken?: string;     // one-time token for POST /api/kyc/upload
};

export async function signInAction(
  _prev: AuthFormState | undefined,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/marketplace");

  if (!email || !password) {
    return { ok: false, error: "Please enter your email and password." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, error: error.message };
  redirect(next);
}

export async function signUpAction(
  _prev: AuthFormState | undefined,
  formData: FormData,
): Promise<AuthFormState> {
  const supabase = await createClient();
  const res = await registerBuyer(supabase, {
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    fullName: String(formData.get("fullName") ?? ""),
    companyName: String(formData.get("companyName") ?? ""),
    country: String(formData.get("country") ?? ""),
    isBusiness: String(formData.get("isBusiness") ?? "") === "true",
    locale: await resolveLocale(),
  });
  if (!res.ok) return { ok: false, error: res.error };

  // Do NOT redirect here: the client runs the document-upload step first
  // (the token / needsConfirm flag drive what it does next).
  return {
    ok: true,
    needsConfirm: res.needsConfirm,
    uploadToken: res.uploadToken,
    message: res.needsConfirm
      ? "Account created — check your email to confirm your address."
      : "Account created.",
  };
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

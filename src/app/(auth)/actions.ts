"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { registerBuyer } from "@/lib/auth/registerBuyer";
import { resolveLocale } from "@/i18n/server";
import { resolveListingNext, sanitizeNext } from "@/lib/listing-redirect";

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
  const requestedNext = sanitizeNext(formData.get("next"));

  if (!email || !password) {
    return { ok: false, error: "Please enter your email and password." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, error: error.message };

  // Account separation: inspectors have a dedicated Inspector app and must not
  // sign into the buyer web. Admins / superadmins may use either surface.
  const uid = data.user?.id;
  if (uid) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", uid)
      .single();
    if ((profile as { role?: string } | null)?.role === "inspector") {
      await supabase.auth.signOut();
      return {
        ok: false,
        error:
          "This is an inspector account. Please use the XportACar Inspector app to sign in.",
      };
    }
  }

  // Never land on a deleted car: a stale /vehicle/<id> or /auction/<id> goes
  // to the marketplace notice instead.
  redirect(await resolveListingNext(supabase, requestedNext));
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

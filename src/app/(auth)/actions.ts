"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { sendWelcomeEmail } from "@/lib/email";

export type AuthFormState = {
  ok: boolean;
  error?: string;
  message?: string;
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
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("fullName") ?? "").trim();
  const companyName = String(formData.get("companyName") ?? "").trim();
  const country = String(formData.get("country") ?? "").trim();

  if (!email || !password || !fullName) {
    return { ok: false, error: "Please fill the required fields." };
  }
  if (password.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, company_name: companyName, country, role: "buyer" },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/marketplace`,
    },
  });
  if (error) return { ok: false, error: error.message };

  // The DB trigger `handle_new_user` inserts the profile row.  As a safety
  // net for environments where the trigger isn't deployed, upsert the row
  // here too — role defaults to 'buyer', kyc_status to 'pending'.
  if (data.user) {
    await supabase
      .from("profiles")
      .upsert(
        {
          id:           data.user.id,
          email,
          full_name:    fullName,
          company_name: companyName || null,
          country:      country     || null,
          role:         "buyer",
          kyc_status:   "pending",
        },
        { onConflict: "id" },
      );
  }

  // Welcome email (best-effort; no-ops silently if RESEND_API_KEY is unset,
  // and never throws). Sent before any redirect below since redirect() throws.
  if (data.user) {
    await sendWelcomeEmail({ to: email, name: fullName });
  }

  // If email confirmation is disabled the user is already a session — send
  // them straight to the marketplace with a welcome toast.
  if (data.session) {
    redirect("/marketplace?welcome=1");
  }
  return { ok: true, message: "Account created — check your email to verify." };
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

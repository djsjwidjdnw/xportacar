import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWelcomeEmail } from "@/lib/email";
import { signKycUploadToken } from "@/lib/kyc/uploadToken";

// Shared buyer-registration core used by the web server action and the mobile
// /api/auth/register endpoint. Creates the auth user (which triggers Supabase's
// confirmation email when confirmation is enabled), upserts the profile, sends
// our welcome email, and mints a one-time KYC upload token so documents can be
// uploaded before the email is confirmed.

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://xportacar.com").replace(/\/+$/, "");

export interface RegisterInput {
  email: string;
  password: string;
  fullName: string;
  companyName?: string;
  country?: string;
  isBusiness?: boolean;
  locale?: string;
}

export interface RegisterResult {
  ok: boolean;
  error?: string;
  needsConfirm?: boolean; // true when no session was returned (confirmation on)
  hasSession?: boolean;
  uploadToken?: string;
}

export async function registerBuyer(
  supabase: SupabaseClient,
  input: RegisterInput,
): Promise<RegisterResult> {
  const email = input.email.trim();
  const fullName = input.fullName.trim();
  const companyName = (input.companyName ?? "").trim();
  const country = (input.country ?? "").trim();
  const isBusiness = !!input.isBusiness;

  if (!email || !input.password || !fullName) {
    return { ok: false, error: "Please fill the required fields." };
  }
  if (input.password.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters." };
  }
  if (isBusiness && !companyName) {
    return { ok: false, error: "Company name is required for a business account." };
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password: input.password,
    options: {
      data: { full_name: fullName, company_name: companyName, country, role: "buyer" },
      emailRedirectTo: `${SITE_URL}/auth/confirm?next=/pending-verification`,
    },
  });
  if (error) return { ok: false, error: error.message };
  if (!data.user) return { ok: false, error: "Could not create the account. Please try again." };

  // Safety net for the profile row (the handle_new_user trigger normally does
  // this). Service-role: when confirmation is on there is no session to satisfy
  // the self-insert RLS check.
  const admin = createAdminClient();
  await admin
    .from("profiles")
    .upsert(
      {
        id:              data.user.id,
        email,
        full_name:       fullName,
        company_name:    companyName || null,
        country:         country     || null,
        role:            "buyer",
        kyc_status:      "pending",
        kyc_is_business: isBusiness,
      },
      { onConflict: "id" },
    );

  await sendWelcomeEmail({ to: email, name: fullName, locale: input.locale });

  return {
    ok: true,
    needsConfirm: !data.session,
    hasSession: !!data.session,
    uploadToken: signKycUploadToken(data.user.id) ?? undefined,
  };
}

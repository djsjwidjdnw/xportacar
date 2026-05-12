"use server";

// Server actions backing the user profile page.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface ProfileFormState {
  ok: boolean;
  error?: string;
  message?: string;
}

const SUPPORTED_LANGS = ["en", "de", "ar", "fr"] as const;

export async function updateProfileAction(
  _prev: ProfileFormState | undefined,
  formData: FormData,
): Promise<ProfileFormState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const fullName        = String(formData.get("full_name")        ?? "").trim();
  const companyName     = String(formData.get("company_name")     ?? "").trim();
  const companyReg      = String(formData.get("company_registration") ?? "").trim();
  const phone           = String(formData.get("phone")            ?? "").trim();
  const country         = String(formData.get("country")          ?? "").trim();
  const language        = String(formData.get("language")         ?? "en");
  const avatarUrl       = String(formData.get("avatar_url")       ?? "").trim();

  if (!fullName) return { ok: false, error: "Full name is required." };
  const lang = (SUPPORTED_LANGS as readonly string[]).includes(language) ? language : "en";

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name:            fullName,
      company_name:         companyName || null,
      company_registration: companyReg  || null,
      phone:                phone       || null,
      country:              country     || null,
      language:             lang,
      avatar_url:           avatarUrl   || null,
    })
    .eq("id", user.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/profile");
  revalidatePath("/dashboard");
  return { ok: true, message: "Profile updated." };
}

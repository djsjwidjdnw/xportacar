"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { savePlatformSettings, type PlatformSettings } from "@/lib/platform-settings";

export interface SettingsResult {
  ok: boolean;
  error?: string;
  settings?: PlatformSettings;
}

// Saves the editable platform-settings JSON. Admin-only; non-admin callers
// get a clean "Admin only" rejection rather than a generic RLS error.
export async function savePlatformSettingsAction(
  input: Partial<PlatformSettings>,
): Promise<SettingsResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !["admin", "superadmin"].includes(profile.role)) {
    return { ok: false, error: "Admin only." };
  }

  const result = await savePlatformSettings(input);
  if (result.ok) revalidatePath("/admin/settings");
  return result;
}

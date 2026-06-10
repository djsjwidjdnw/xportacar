"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface AdminResult {
  ok: boolean;
  error?: string;
}

// Admin gate — mirrors requireAdmin() in ../actions.ts.
async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, error: "Not signed in." as string | null };
  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !["admin", "superadmin"].includes(profile.role)) {
    return { supabase, error: "Admin only." };
  }
  return { supabase, error: null };
}

// Deactivate an inspector: drop them back to a buyer role and mark their
// application suspended (best-effort) so they stop appearing as active staff.
export async function deactivateInspectorAction(userId: string): Promise<AdminResult> {
  const { supabase, error: authErr } = await requireAdmin();
  if (authErr) return { ok: false, error: authErr };

  const { error } = await supabase
    .from("profiles")
    .update({ role: "buyer" })
    .eq("id", userId);
  if (error) return { ok: false, error: error.message };

  // Best-effort — keep the deactivation successful even if there is no
  // application row (e.g. an inspector promoted manually via the users page).
  const { error: appErr } = await supabase
    .from("inspector_applications")
    .update({ status: "suspended" })
    .eq("user_id", userId);
  if (appErr) console.error("[inspectors] suspend application failed:", appErr.message);

  revalidatePath("/admin/inspectors");
  return { ok: true };
}

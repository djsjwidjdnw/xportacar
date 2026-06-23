"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export interface PrelaunchResult {
  ok: boolean;
  error?: string;
}

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, error: "Not signed in." as const };
  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  const role = (profile as { role?: string } | null)?.role;
  if (!role || !["admin", "superadmin"].includes(role)) {
    return { user: null, error: "Admin only." as const };
  }
  return { user, error: null };
}

async function writeSetting(key: string, value: unknown, adminId: string) {
  const admin = createAdminClient();
  return admin.from("app_settings").upsert(
    { key, value, updated_at: new Date().toISOString(), updated_by: adminId },
    { onConflict: "key" },
  );
}

export async function toggleLandingMode(enabled: boolean): Promise<PrelaunchResult> {
  const { user, error } = await requireAdmin();
  if (error || !user) return { ok: false, error: error ?? "Admin only." };
  const { error: e } = await writeSetting("landing_mode_enabled", enabled, user.id);
  if (e) return { ok: false, error: e.message };
  revalidatePath("/");
  revalidatePath("/admin/prelaunch");
  return { ok: true };
}

export async function setCountdown(targetIso: string): Promise<PrelaunchResult> {
  const { user, error } = await requireAdmin();
  if (error || !user) return { ok: false, error: error ?? "Admin only." };
  const d = new Date(targetIso);
  if (Number.isNaN(d.getTime())) return { ok: false, error: "Pick a valid date and time." };
  const { error: e } = await writeSetting("launch_countdown_target", d.toISOString(), user.id);
  if (e) return { ok: false, error: e.message };
  revalidatePath("/");
  revalidatePath("/admin/prelaunch");
  return { ok: true };
}

export async function clearCountdown(): Promise<PrelaunchResult> {
  const { user, error } = await requireAdmin();
  if (error || !user) return { ok: false, error: error ?? "Admin only." };
  // Store `false` (not SQL NULL — the column is NOT NULL); the homepage reader
  // treats any non-string value as "no countdown".
  const { error: e } = await writeSetting("launch_countdown_target", false, user.id);
  if (e) return { ok: false, error: e.message };
  revalidatePath("/");
  revalidatePath("/admin/prelaunch");
  return { ok: true };
}

export async function exportSignupsCSV(): Promise<{ ok: boolean; csv?: string; error?: string }> {
  const { user, error } = await requireAdmin();
  if (error || !user) return { ok: false, error: error ?? "Admin only." };
  const admin = createAdminClient();
  const { data, error: e } = await admin
    .from("prelaunch_signups")
    .select("email, ip_country, created_at")
    .order("created_at", { ascending: false });
  if (e) return { ok: false, error: e.message };
  const rows = (data ?? []) as { email: string; ip_country: string | null; created_at: string }[];
  const header = "email,country,created_at";
  const body = rows.map((r) => [csvCell(r.email), csvCell(r.ip_country ?? ""), csvCell(r.created_at)].join(",")).join("\n");
  return { ok: true, csv: `${header}\n${body}\n` };
}

// CSV-safe: neutralise formula injection (leading = + - @) and quote/escape.
function csvCell(input: string): string {
  let s = input ?? "";
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  if (/[",\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

"use server";

// Lifecycle transitions for a SOLD vehicle: sold → picked_up → in_transit →
// delivered. Each transition updates vehicles.status, records a
// vehicle_status_events row (with optional note/photo the buyer timeline shows),
// logs to admin_audit_log, and emails the winning buyer (localized, best-effort).

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  sendStatusPickedUpEmail, sendStatusInTransitEmail, sendStatusDeliveredEmail,
} from "@/lib/email";

export type LifecycleStatus = "picked_up" | "in_transit" | "delivered";

// Allowed previous status for each target (enforces the linear order).
const PREV: Record<LifecycleStatus, string> = {
  picked_up: "sold",
  in_transit: "picked_up",
  delivered: "in_transit",
};

export async function setLifecycleStatusAction(input: {
  vehicleId: string;
  next: LifecycleStatus;
  note?: string;
  photoUrl?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!me || !["admin", "superadmin"].includes((me as { role: string }).role)) {
    return { ok: false, error: "Admin only." };
  }

  const admin = createAdminClient();

  // Validate the transition against the current status.
  const { data: vRow } = await admin
    .from("vehicles").select("status, make, model, year").eq("id", input.vehicleId).single();
  const v = vRow as { status?: string; make?: string; model?: string; year?: number } | null;
  if (!v) return { ok: false, error: "Vehicle not found." };
  if (v.status !== PREV[input.next]) {
    return { ok: false, error: `Cannot mark "${input.next}" from "${v.status}".` };
  }

  const note = input.note?.trim() || null;

  const { error: upErr } = await admin
    .from("vehicles").update({ status: input.next }).eq("id", input.vehicleId);
  if (upErr) return { ok: false, error: upErr.message };

  // History row for the buyer timeline.
  await admin.from("vehicle_status_events").insert({
    vehicle_id: input.vehicleId,
    status: input.next,
    note,
    photo_url: input.photoUrl ?? null,
    actor_id: user.id,
  });

  // Audit log.
  await admin.from("admin_audit_log").insert({
    actor_id: user.id, entity_type: "vehicle", entity_id: input.vehicleId,
    action: `lifecycle_${input.next}`, changes: { status: { from: v.status, to: input.next } }, note,
  });

  // Email the winning buyer (localized, best-effort).
  try {
    const { data: auction } = await admin
      .from("auctions").select("winner_id").eq("vehicle_id", input.vehicleId)
      .not("winner_id", "is", null).order("end_time", { ascending: false }).limit(1).maybeSingle();
    const winnerId = (auction as { winner_id?: string } | null)?.winner_id;
    if (winnerId) {
      const { data: buyer } = await admin
        .from("profiles").select("email, full_name, language, country").eq("id", winnerId).single();
      const b = buyer as { email?: string; full_name?: string; language?: string; country?: string } | null;
      if (b?.email) {
        const title = `${v.year ?? ""} ${v.make ?? ""} ${v.model ?? ""}`.trim();
        const common = { to: b.email, name: b.full_name ?? "", vehicleTitle: title, note: note ?? undefined, locale: b.language };
        if (input.next === "picked_up") await sendStatusPickedUpEmail(common);
        else if (input.next === "in_transit") await sendStatusInTransitEmail({ ...common, destination: b.country ?? undefined });
        else await sendStatusDeliveredEmail(common);
      }
    }
  } catch { /* email is best-effort */ }

  revalidatePath(`/admin/vehicles/${input.vehicleId}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

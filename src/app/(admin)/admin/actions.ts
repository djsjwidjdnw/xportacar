"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { VehicleStatus } from "@/types";

export interface AdminResult {
  ok: boolean;
  error?: string;
}

const ALLOWED: VehicleStatus[] = [
  "draft",
  "inspection_scheduled",
  "inspected",
  "listed",
  "in_auction",
  "sold",
  "payment_pending",
  "paid",
  "collected",
  "shipped",
  "delivered",
];

export async function setVehicleStatusAction(
  vehicleId: string,
  status: VehicleStatus,
): Promise<AdminResult> {
  if (!ALLOWED.includes(status)) return { ok: false, error: "Invalid status." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  // RLS: only staff can update vehicles, so a non-admin call will get an
  // empty-result error.  Confirm role here so we can return a clean message.
  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !["admin", "superadmin", "inspector"].includes(profile.role)) {
    return { ok: false, error: "Staff only." };
  }

  const { error } = await supabase
    .from("vehicles")
    .update({ status })
    .eq("id", vehicleId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/vehicles");
  revalidatePath(`/admin/vehicles/${vehicleId}`);
  return { ok: true };
}

export async function assignInspectorAction(
  vehicleId: string,
  inspectorId: string | null,
): Promise<AdminResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !["admin", "superadmin"].includes(profile.role)) {
    return { ok: false, error: "Admin only." };
  }

  const { error } = await supabase
    .from("vehicles")
    .update({ inspector_id: inspectorId })
    .eq("id", vehicleId);
  if (error) return { ok: false, error: error.message };

  // Notify the inspector if assignment changed.
  if (inspectorId) {
    const { data: vehicle } = await supabase
      .from("vehicles").select("year, make, model").eq("id", vehicleId).single();
    await supabase.from("notifications").insert({
      user_id: inspectorId,
      type:    "status_update",
      title:   "New inspection assigned",
      body:    vehicle
        ? `${vehicle.year} ${vehicle.make} ${vehicle.model} has been assigned to you for inspection.`
        : "A vehicle has been assigned to you for inspection.",
      data:    { vehicle_id: vehicleId },
    });
  }

  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/vehicles");
  revalidatePath(`/admin/vehicles/${vehicleId}`);
  return { ok: true };
}

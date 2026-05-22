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
  revalidatePath("/admin/inspections");
  revalidatePath(`/admin/vehicles/${vehicleId}`);
  return { ok: true };
}

// --------------------------------------------------------------------
// User role assignment (admin → admin/buyer/inspector/superadmin)
// --------------------------------------------------------------------
const ALLOWED_ROLES = ["buyer", "inspector", "admin", "superadmin"] as const;
type Role = (typeof ALLOWED_ROLES)[number];

export async function setUserRoleAction(
  userId: string,
  role: Role,
): Promise<AdminResult> {
  if (!ALLOWED_ROLES.includes(role)) return { ok: false, error: "Invalid role." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };
  if (user.id === userId && role !== "superadmin" && role !== "admin") {
    return { ok: false, error: "You can't demote yourself." };
  }

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !["admin", "superadmin"].includes(profile.role)) {
    return { ok: false, error: "Admin only." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ role })
    .eq("id", userId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/users");
  return { ok: true };
}

// --------------------------------------------------------------------
// KYC inline approve / reject  (sets profiles.kyc_status)
// --------------------------------------------------------------------
const ALLOWED_KYC = ["pending", "verified", "rejected"] as const;
type KycStatus = (typeof ALLOWED_KYC)[number];

export async function setUserKycStatusAction(
  userId: string,
  kycStatus: KycStatus,
): Promise<AdminResult> {
  if (!ALLOWED_KYC.includes(kycStatus)) return { ok: false, error: "Invalid KYC status." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !["admin", "superadmin"].includes(profile.role)) {
    return { ok: false, error: "Admin only." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ kyc_status: kycStatus })
    .eq("id", userId);
  if (error) return { ok: false, error: error.message };

  // Notification — close the loop with the buyer.
  await supabase.from("notifications").insert({
    user_id: userId,
    type:    "status_update",
    title:   kycStatus === "verified"
      ? "Your account is verified"
      : kycStatus === "rejected"
        ? "KYC verification was rejected"
        : "KYC review pending",
    body: kycStatus === "verified"
      ? "Welcome aboard — you can now bid on live auctions."
      : kycStatus === "rejected"
        ? "Our compliance team rejected your submission. Please re-upload clear documents."
        : "Your account has been moved back to pending review.",
  });

  revalidatePath("/admin/users");
  revalidatePath("/admin/kyc");
  return { ok: true };
}

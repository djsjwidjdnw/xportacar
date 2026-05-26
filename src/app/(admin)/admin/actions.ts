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

  // Load current status so we can promote the vehicle into the inspector's
  // queue. Without this the inspector_id was set but a "listed"/"draft"
  // vehicle never showed on the inspector dashboard (which filters on
  // status in inspection_scheduled/draft) — the "assignment doesn't work" bug.
  const { data: vehicle } = await supabase
    .from("vehicles").select("status, year, make, model").eq("id", vehicleId).single();

  const update: { inspector_id: string | null; status?: string } = { inspector_id: inspectorId };
  if (inspectorId && vehicle && (vehicle.status === "listed" || vehicle.status === "draft")) {
    update.status = "inspection_scheduled";
  }

  const { error } = await supabase
    .from("vehicles")
    .update(update)
    .eq("id", vehicleId);
  if (error) return { ok: false, error: error.message };

  // Notify the inspector if assignment changed.
  if (inspectorId) {
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
// Create a new vehicle (admin → "Add New Vehicle"), ready for inspection
// --------------------------------------------------------------------
export async function createVehicleAction(input: {
  make: string;
  model: string;
  year: number;
  vin: string;
  sellerName?: string;
  sellerPhone?: string;
}): Promise<AdminResult & { id?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !["admin", "superadmin"].includes(profile.role)) {
    return { ok: false, error: "Admin only." };
  }

  const make = input.make?.trim();
  const model = input.model?.trim();
  const vin = input.vin?.trim().toUpperCase();
  const year = Number(input.year);
  if (!make || !model || !vin || !Number.isFinite(year) || year < 1950 || year > 2100) {
    return { ok: false, error: "Make, model, VIN and a valid year are required." };
  }

  const { data, error } = await supabase
    .from("vehicles")
    .insert({
      vin,
      make,
      model,
      year,
      mileage_km: 0,
      fuel_type: "petrol",
      transmission: "automatic",
      location_city: "Dubai",
      location_country: "UAE",
      status: "inspection_scheduled",
      seller_name: input.sellerName?.trim() || "Walk-in",
      seller_phone: input.sellerPhone?.trim() || null,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/vehicles");
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/inspections");
  return { ok: true, id: (data as { id: string }).id };
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

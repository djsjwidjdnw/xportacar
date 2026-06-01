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
  "pending_review",
  "changes_requested",
  "listed",
  "in_auction",
  "sold",
  "payment_pending",
  "paid",
  "collected",
  "shipped",
  "delivered",
];

// Single-row platform_settings PK (see migration 003).
const SETTINGS_ID = "00000000-0000-0000-0000-000000000001";

// Admin gate shared by every action below: returns the request-scoped client
// plus a clean "Admin only" message instead of a raw RLS error.
async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, error: "Not signed in." as string | null };
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !["admin", "superadmin"].includes(profile.role)) {
    return { supabase, error: "Admin only." };
  }
  return { supabase, error: null };
}

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

type ServerClient = Awaited<ReturnType<typeof createClient>>;

function revalidateAdmin(vehicleId?: string) {
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/vehicles");
  revalidatePath("/admin/inspections");
  if (vehicleId) revalidatePath(`/admin/vehicles/${vehicleId}`);
}

// Core assignment used by all three methods (dropdown / email / auto-assign).
// Sets inspector_id, promotes a draft/listed vehicle into the inspector's
// queue (status → inspection_scheduled), and drops a notification.
async function applyAssignment(
  supabase: ServerClient,
  vehicleId: string,
  inspectorId: string | null,
): Promise<AdminResult> {
  const { data: vehicle } = await supabase
    .from("vehicles").select("status, year, make, model").eq("id", vehicleId).single();

  const update: { inspector_id: string | null; status?: string } = { inspector_id: inspectorId };
  // Promote into the inspector's queue. The inspector dashboard lists vehicles
  // with status inspection_scheduled/draft, so without this an assigned
  // "listed" vehicle would never appear — the long-standing "assignment
  // doesn't work" bug.
  if (inspectorId && vehicle && (vehicle.status === "listed" || vehicle.status === "draft")) {
    update.status = "inspection_scheduled";
  }

  const { error } = await supabase.from("vehicles").update(update).eq("id", vehicleId);
  if (error) return { ok: false, error: error.message };

  if (inspectorId) {
    await supabase.from("notifications").insert({
      user_id: inspectorId,
      type:    "status_update",
      title:   "New vehicle assigned",
      body:    vehicle
        ? `New vehicle assigned: ${vehicle.year} ${vehicle.make} ${vehicle.model}`
        : "A vehicle has been assigned to you for inspection.",
      data:    { vehicle_id: vehicleId },
    });
  }
  return { ok: true };
}

// METHOD A — dropdown picker. inspectorId is a profile id (or null to clear).
export async function assignInspectorAction(
  vehicleId: string,
  inspectorId: string | null,
): Promise<AdminResult> {
  const { supabase, error: authErr } = await requireAdmin();
  if (authErr) return { ok: false, error: authErr };

  const res = await applyAssignment(supabase, vehicleId, inspectorId);
  if (!res.ok) return res;
  revalidateAdmin(vehicleId);
  return res;
}

// METHOD B — assign by typing an inspector's email address.
export async function assignInspectorByEmailAction(
  vehicleId: string,
  email: string,
): Promise<AdminResult & { inspectorName?: string }> {
  const { supabase, error: authErr } = await requireAdmin();
  if (authErr) return { ok: false, error: authErr };

  const clean = email.trim();
  if (!clean) return { ok: false, error: "Enter an email address." };

  const { data: profile } = await supabase
    .from("profiles").select("id, role, full_name, email").ilike("email", clean).maybeSingle();
  if (!profile) return { ok: false, error: `No user found with email "${clean}".` };
  if (profile.role !== "inspector") {
    return { ok: false, error: `${profile.email ?? clean} is a "${profile.role}", not an inspector.` };
  }

  const res = await applyAssignment(supabase, vehicleId, profile.id);
  if (!res.ok) return res;
  revalidateAdmin(vehicleId);
  return { ok: true, inspectorName: profile.full_name ?? profile.email ?? clean };
}

// METHOD C — round-robin auto-assign every unassigned vehicle across all
// inspectors. The cursor (last_inspector_index) lives on platform_settings so
// the rotation continues across calls.
export async function autoAssignInspectorsAction(): Promise<AdminResult & { assigned?: number }> {
  const { supabase, error: authErr } = await requireAdmin();
  if (authErr) return { ok: false, error: authErr };

  const { data: inspectorsRaw } = await supabase
    .from("profiles").select("id, full_name, email").eq("role", "inspector").order("created_at", { ascending: true });
  const inspectors = (inspectorsRaw ?? []) as { id: string }[];
  if (inspectors.length === 0) return { ok: false, error: "No inspectors found. Create an inspector account first." };

  const { data: vehiclesRaw } = await supabase
    .from("vehicles")
    .select("id, year, make, model")
    .is("inspector_id", null)
    .in("status", ["draft", "inspection_scheduled"])
    .order("created_at", { ascending: true });
  const vehicles = (vehiclesRaw ?? []) as { id: string; year: number; make: string; model: string }[];
  if (vehicles.length === 0) return { ok: true, assigned: 0 };

  // Read the rotation cursor (column may not exist before migration 005 — fall
  // back to 0 so auto-assign still works, it just always starts from the top).
  let start = 0;
  try {
    const { data: settings } = await supabase
      .from("platform_settings").select("last_inspector_index").eq("id", SETTINGS_ID).maybeSingle();
    const idx = (settings as { last_inspector_index?: number } | null)?.last_inspector_index;
    if (typeof idx === "number") start = idx;
  } catch { /* column missing — start from 0 */ }

  const n = inspectors.length;
  let cursor = start;
  for (let i = 0; i < vehicles.length; i++) {
    cursor = (start + 1 + i) % n;
    const v = vehicles[i];
    await supabase.from("vehicles").update({ inspector_id: inspectors[cursor].id, status: "inspection_scheduled" }).eq("id", v.id);
    await supabase.from("notifications").insert({
      user_id: inspectors[cursor].id,
      type:    "status_update",
      title:   "New vehicle assigned",
      body:    `New vehicle assigned: ${v.year} ${v.make} ${v.model}`,
      data:    { vehicle_id: v.id },
    });
  }

  // Persist the rotation cursor (best-effort — ignored if column absent).
  try {
    await supabase.from("platform_settings").update({ last_inspector_index: cursor }).eq("id", SETTINGS_ID);
  } catch { /* column missing */ }

  revalidateAdmin();
  return { ok: true, assigned: vehicles.length };
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
// Schedule a new inspection (admin → "New Inspection"): pick an existing
// un-inspected vehicle OR create one inline, then assign it to an inspector
// and move it into status inspection_scheduled — in one step.
// --------------------------------------------------------------------
export interface NewVehicleInput {
  make: string;
  model: string;
  year: number;
  vin: string;
  sellerName?: string;
  sellerPhone?: string;
}
export async function scheduleInspectionAction(input: {
  mode: "existing" | "new";
  vehicleId?: string | null;
  newVehicle?: NewVehicleInput;
  inspectorId: string;
}): Promise<AdminResult & { id?: string }> {
  const { supabase, error: authErr } = await requireAdmin();
  if (authErr) return { ok: false, error: authErr };

  if (!input.inspectorId) return { ok: false, error: "Select an inspector." };
  const { data: insp } = await supabase
    .from("profiles").select("id, role").eq("id", input.inspectorId).maybeSingle();
  if (!insp || (insp as { role?: string }).role !== "inspector") {
    return { ok: false, error: "The selected user is not an inspector." };
  }

  let vehicleId = input.vehicleId ?? null;

  if (input.mode === "new") {
    const nv = input.newVehicle;
    const make = nv?.make?.trim();
    const model = nv?.model?.trim();
    const vin = nv?.vin?.trim().toUpperCase();
    const year = Number(nv?.year);
    if (!make || !model || !vin || !Number.isFinite(year) || year < 1950 || year > 2100) {
      return { ok: false, error: "Make, model, VIN and a valid year are required." };
    }
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("vehicles")
      .insert({
        vin, make, model, year,
        mileage_km: 0,
        fuel_type: "petrol",
        transmission: "automatic",
        location_city: "Dubai",
        location_country: "UAE",
        status: "inspection_scheduled",
        seller_name: nv?.sellerName?.trim() || "Walk-in",
        seller_phone: nv?.sellerPhone?.trim() || null,
        inspector_id: input.inspectorId,
        created_by: user?.id,
      })
      .select("id")
      .single();
    if (error) return { ok: false, error: error.message };
    vehicleId = (data as { id: string }).id;
  } else {
    if (!vehicleId) return { ok: false, error: "Select a vehicle to inspect." };
    const { error } = await supabase
      .from("vehicles")
      .update({ inspector_id: input.inspectorId, status: "inspection_scheduled" })
      .eq("id", vehicleId);
    if (error) return { ok: false, error: error.message };
  }

  const { data: v } = await supabase
    .from("vehicles").select("year, make, model").eq("id", vehicleId).single();
  await supabase.from("notifications").insert({
    user_id: input.inspectorId,
    type: "status_update",
    title: "New inspection assigned",
    body: v
      ? `Inspection scheduled: ${v.year} ${v.make} ${v.model}`
      : "An inspection has been scheduled for you.",
    data: { vehicle_id: vehicleId },
  });

  revalidateAdmin(vehicleId ?? undefined);
  return { ok: true, id: vehicleId ?? undefined };
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

// =====================================================================
// Review workflow — pending_review → listed / changes_requested
// =====================================================================

// Approve a pending_review vehicle and publish it to the marketplace.
export async function approveAndListAction(vehicleId: string): Promise<AdminResult> {
  const { supabase, error: authErr } = await requireAdmin();
  if (authErr) return { ok: false, error: authErr };
  const { error } = await supabase
    .from("vehicles").update({ status: "listed", review_notes: null }).eq("id", vehicleId);
  if (error) return { ok: false, error: error.message };
  revalidateAdmin(vehicleId);
  revalidatePath("/marketplace");
  return { ok: true };
}

// Send a vehicle back to its inspector with feedback.
export async function requestChangesAction(vehicleId: string, notes: string): Promise<AdminResult> {
  const { supabase, error: authErr } = await requireAdmin();
  if (authErr) return { ok: false, error: authErr };
  const clean = notes.trim();
  if (!clean) return { ok: false, error: "Describe what needs changing." };

  const { data: vehicle } = await supabase
    .from("vehicles").select("inspector_id, year, make, model").eq("id", vehicleId).single();

  const { error } = await supabase
    .from("vehicles").update({ status: "changes_requested", review_notes: clean }).eq("id", vehicleId);
  if (error) return { ok: false, error: error.message };

  const inspectorId = (vehicle as { inspector_id?: string | null } | null)?.inspector_id;
  if (inspectorId) {
    await supabase.from("notifications").insert({
      user_id: inspectorId,
      type: "status_update",
      title: "Changes requested",
      body: vehicle
        ? `Changes requested on ${vehicle.year} ${vehicle.make} ${vehicle.model}: ${clean}`
        : clean,
      data: { vehicle_id: vehicleId },
    });
  }
  revalidateAdmin(vehicleId);
  return { ok: true };
}

// Edit key listing fields then publish (the "Edit & List" path).
export interface ListingEdit {
  listed_price_eur?: number | null;
  reserve_price_eur?: number | null;
  buy_now_price_eur?: number | null;
  description?: string | null;
}
export async function updateListingAndListAction(vehicleId: string, edit: ListingEdit): Promise<AdminResult> {
  const { supabase, error: authErr } = await requireAdmin();
  if (authErr) return { ok: false, error: authErr };
  const update: Record<string, unknown> = { status: "listed", review_notes: null };
  if (edit.listed_price_eur !== undefined) update.listed_price_eur = edit.listed_price_eur;
  if (edit.reserve_price_eur !== undefined) update.reserve_price_eur = edit.reserve_price_eur;
  if (edit.buy_now_price_eur !== undefined) update.buy_now_price_eur = edit.buy_now_price_eur;
  if (edit.description !== undefined) update.description = edit.description;
  const { error } = await supabase.from("vehicles").update(update).eq("id", vehicleId);
  if (error) return { ok: false, error: error.message };
  revalidateAdmin(vehicleId);
  revalidatePath("/marketplace");
  return { ok: true };
}

// =====================================================================
// Create an auction for a listed vehicle.
// =====================================================================
export interface CreateAuctionInput {
  vehicleId: string;
  startingPriceEur: number;
  reservePriceEur?: number | null;
  buyNowPriceEur?: number | null;
  durationHours: number;
  startMode: "now" | "schedule";
  startTimeISO?: string | null;
}
export async function createAuctionAction(
  input: CreateAuctionInput,
): Promise<AdminResult & { auctionId?: string }> {
  const { supabase, error: authErr } = await requireAdmin();
  if (authErr) return { ok: false, error: authErr };

  const starting = Number(input.startingPriceEur);
  if (!Number.isFinite(starting) || starting <= 0) return { ok: false, error: "Enter a valid starting price." };
  const hours = Number(input.durationHours);
  if (!Number.isFinite(hours) || hours <= 0) return { ok: false, error: "Choose an auction duration." };

  const start = input.startMode === "schedule" && input.startTimeISO ? new Date(input.startTimeISO) : new Date();
  if (Number.isNaN(start.getTime())) return { ok: false, error: "Invalid start time." };
  const end = new Date(start.getTime() + hours * 3_600_000);

  const reserve = input.reservePriceEur != null && Number(input.reservePriceEur) > 0 ? Number(input.reservePriceEur) : null;
  if (reserve != null && reserve < starting) return { ok: false, error: "Reserve cannot be below the starting price." };

  // Buy Now is MANDATORY on every auction. If the admin leaves it blank we
  // auto-calculate it: reserve * 1.22 when a reserve is set (≈22% margin, like
  // the Porsche demo), otherwise starting * 1.5. Always rounded to whole euros
  // and never below the starting price.
  let buyNow = input.buyNowPriceEur != null && Number(input.buyNowPriceEur) > 0 ? Number(input.buyNowPriceEur) : null;
  if (buyNow == null) buyNow = Math.round(reserve != null ? reserve * 1.22 : starting * 1.5);
  if (buyNow < starting) return { ok: false, error: "Buy-now cannot be below the starting price." };

  // Active when it starts now (or in the past); otherwise scheduled for later.
  const status = start.getTime() <= Date.now() + 60_000 ? "active" : "scheduled";

  const { data, error } = await supabase
    .from("auctions")
    .upsert({
      vehicle_id: input.vehicleId,
      status,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      starting_price_eur: starting,
      reserve_price_eur: reserve,
      buy_now_price_eur: buyNow,
      current_bid_eur: null,
      bid_count: 0,
      bidder_count: 0,
      winner_id: null,
    }, { onConflict: "vehicle_id" })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  const { error: vErr } = await supabase
    .from("vehicles")
    .update({ status: "in_auction", listed_price_eur: starting, reserve_price_eur: reserve, buy_now_price_eur: buyNow })
    .eq("id", input.vehicleId);
  if (vErr) return { ok: false, error: vErr.message };

  revalidateAdmin(input.vehicleId);
  revalidatePath("/admin/auctions");
  revalidatePath("/marketplace");
  revalidatePath("/auctions");
  const auctionId = (data as { id: string }).id;
  revalidatePath(`/auction/${auctionId}`);
  return { ok: true, auctionId };
}

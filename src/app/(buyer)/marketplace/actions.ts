"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { fetchVehiclesPage, type MarketplaceSearchParams } from "./query";
import type { VehicleWithMedia } from "@/types";

// Next page of marketplace vehicles + which of them the user is watching.
// Backs the "Load more" button so the browser never loads all 100k at once.
export async function loadMoreVehiclesAction(
  sp: MarketplaceSearchParams,
  offset: number,
): Promise<{ vehicles: VehicleWithMedia[]; hasMore: boolean; watching: string[] }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { vehicles, hasMore } = await fetchVehiclesPage(supabase, sp, offset);

  let watching: string[] = [];
  if (user && vehicles.length > 0) {
    const { data: w } = await supabase
      .from("watchlist")
      .select("vehicle_id")
      .eq("user_id", user.id)
      .in("vehicle_id", vehicles.map((v) => v.id));
    watching = (w ?? []).map((r) => (r as { vehicle_id: string }).vehicle_id);
  }

  return { vehicles, hasMore, watching };
}

export interface SaveSearchInput {
  name: string;
  filters: Record<string, string>;
}

export async function saveSearchAction(input: SaveSearchInput): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in to save searches." };
  if (!input.name.trim()) return { ok: false, error: "Give your search a name." };

  const { error } = await supabase
    .from("saved_searches")
    .insert({ user_id: user.id, name: input.name.trim(), filters: input.filters });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteSavedSearchAction(id: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase
    .from("saved_searches")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard");
  return { ok: true };
}

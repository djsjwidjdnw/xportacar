"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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

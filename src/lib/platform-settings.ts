// Server-only loaders for the platform settings JSON blob persisted in
// Supabase Storage. Pure data types + defaults live in
// `platform-settings-shared.ts` so client components can import them
// without dragging the admin Supabase client into the browser bundle.

import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  DEFAULT_PLATFORM_SETTINGS, sanitizePlatformSettings,
  type PlatformSettings,
} from "./platform-settings-shared";

export type { PlatformSettings };
export { DEFAULT_PLATFORM_SETTINGS } from "./platform-settings-shared";

const STORAGE_BUCKET = "vehicle-photos";
const STORAGE_PATH   = "_internal/platform-settings.json";

export async function loadPlatformSettings(): Promise<PlatformSettings> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.storage.from(STORAGE_BUCKET).download(STORAGE_PATH);
    if (error || !data) return DEFAULT_PLATFORM_SETTINGS;
    const text = await data.text();
    const json = JSON.parse(text) as Partial<PlatformSettings>;
    return sanitizePlatformSettings(json);
  } catch {
    return DEFAULT_PLATFORM_SETTINGS;
  }
}

export async function savePlatformSettings(input: Partial<PlatformSettings>): Promise<{ ok: boolean; error?: string; settings?: PlatformSettings }> {
  const next = sanitizePlatformSettings(input);
  try {
    const admin = createAdminClient();
    try {
      await admin.storage.createBucket(STORAGE_BUCKET, { public: true });
    } catch { /* already exists */ }

    const body = new Blob([JSON.stringify(next, null, 2)], { type: "application/json" });
    const { error } = await admin.storage
      .from(STORAGE_BUCKET)
      .upload(STORAGE_PATH, body, { upsert: true, contentType: "application/json" });
    if (error) return { ok: false, error: error.message };
    return { ok: true, settings: next };
  } catch (e) {
    return { ok: false, error: (e as Error).message ?? "Save failed" };
  }
}

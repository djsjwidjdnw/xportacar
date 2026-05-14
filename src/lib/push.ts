// Expo Push API wrapper.  Fans a notification out to every registered
// device for a user.  Silently no-ops when there are no tokens — matches
// the email helper's "skip if not configured" pattern.

import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

interface PushPayload {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

const EXPO_API = "https://exp.host/--/api/v2/push/send";

export async function sendPushToUser(payload: PushPayload): Promise<void> {
  const admin = createAdminClient();
  const { data: tokens } = await admin
    .from("push_tokens")
    .select("token")
    .eq("user_id", payload.userId);
  const list = (tokens ?? []).map((t) => (t as { token: string }).token).filter(Boolean);
  if (list.length === 0) return;

  const messages = list.map((to) => ({
    to,
    sound: "default",
    title: payload.title,
    body: payload.body,
    data: payload.data ?? {},
  }));

  try {
    await fetch(EXPO_API, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(messages),
    });
  } catch {
    /* swallow — push is best-effort */
  }
}

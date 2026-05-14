// POST /api/push-tokens — register an Expo push token for the signed-in user.
// Used by the mobile apps.  Idempotent: upserts on (user_id, token).

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { DevicePlatform } from "@/types";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });

  let body: { token?: string; platform?: DevicePlatform; device_name?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Bad JSON" }, { status: 400 }); }
  if (!body.token || !body.platform) {
    return NextResponse.json({ ok: false, error: "token and platform required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("push_tokens")
    .upsert({
      user_id:     user.id,
      token:       body.token,
      platform:    body.platform,
      device_name: body.device_name ?? null,
      last_seen:   new Date().toISOString(),
    }, { onConflict: "user_id,token" });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  if (!token) return NextResponse.json({ ok: false, error: "token required" }, { status: 400 });

  await supabase.from("push_tokens").delete().eq("user_id", user.id).eq("token", token);
  return NextResponse.json({ ok: true });
}

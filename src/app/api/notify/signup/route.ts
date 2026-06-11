// POST /api/notify/signup — called by the mobile apps right after a successful
// signup (they don't hit a Next server action). Sends the welcome email to the
// new user (in their language), and for inspector signups also alerts all
// admins with the application details. Authenticated by the caller's Supabase
// JWT (Authorization: Bearer <access_token>). Best-effort: email failures never
// fail the request.

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWelcomeEmail, sendNewInspectorApplicationEmail } from "@/lib/email";

export const runtime = "nodejs";

export async function POST(req: Request) {
  // Temporary observability (visible in Vercel logs) to verify the welcome-email
  // path end-to-end. Safe to remove once confirmed working.
  console.log("[notify/signup] called");

  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) {
    console.warn("[notify/signup] no bearer token");
    return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    // Admin client not configured (no service-role key) — nothing to do.
    console.warn("[notify/signup] admin client unavailable (SUPABASE_SERVICE_ROLE_KEY?)");
    return NextResponse.json({ ok: true, skipped: "no-admin-client" });
  }

  // Validate the JWT and resolve the user.
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  const user = userData?.user;
  if (userErr || !user) {
    console.warn("[notify/signup] invalid session:", userErr?.message ?? "no user");
    return NextResponse.json({ ok: false, error: "Invalid session" }, { status: 401 });
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("email, full_name, role, language")
    .eq("id", user.id)
    .single();
  const p = profile as { email?: string | null; full_name?: string | null; role?: string | null; language?: string | null } | null;

  const to = p?.email ?? user.email ?? "";
  const name = p?.full_name ?? "";
  const locale = p?.language ?? undefined;
  console.log(`[notify/signup] user=${user.id} to=${to || "(none)"} role=${p?.role ?? "?"} locale=${locale ?? "en"}`);

  // 1) Welcome email to the new user.
  if (to) {
    await sendWelcomeEmail({ to, name, locale });
    console.log(`[notify/signup] welcome email dispatched to ${to}`);
  } else {
    console.warn("[notify/signup] no recipient email resolved — welcome skipped");
  }

  // 2) Inspector signup → alert every admin with the application details.
  if (p?.role === "inspector") {
    const { data: appRow } = await admin
      .from("inspector_applications")
      .select("full_name, email, country, city, experience")
      .eq("user_id", user.id)
      .maybeSingle();
    const a = appRow as
      | { full_name?: string | null; email?: string | null; country?: string | null; city?: string | null; experience?: string | null }
      | null;

    const { data: admins } = await admin
      .from("profiles")
      .select("email, language")
      .in("role", ["admin", "superadmin"]);

    for (const adm of (admins ?? []) as { email?: string | null; language?: string | null }[]) {
      if (!adm.email) continue;
      await sendNewInspectorApplicationEmail({
        to: adm.email,
        applicantName: a?.full_name ?? name,
        applicantEmail: a?.email ?? to,
        country: a?.country ?? undefined,
        city: a?.city ?? undefined,
        experience: a?.experience ?? undefined,
        locale: adm.language ?? undefined,
      });
    }
  }

  return NextResponse.json({ ok: true });
}

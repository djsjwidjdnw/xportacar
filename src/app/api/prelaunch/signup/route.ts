import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { addToPrelaunchAudience } from "@/lib/email/audiences";

export const runtime = "nodejs";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// Marketing email capture for the pre-launch landing page. Stores in Supabase
// (source of truth) and best-effort pushes to the Resend audience. Never fails
// the signup because the Resend push failed.
export async function POST(req: Request) {
  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
    return NextResponse.json({ ok: false, error: "Enter a valid email address." }, { status: 400 });
  }

  // Best-effort marketing push (returns null if Resend isn't configured/fails).
  const contactId = await addToPrelaunchAudience(email);

  const admin = createAdminClient();
  const { error } = await admin.from("prelaunch_signups").upsert(
    {
      email,
      source: "landing",
      user_agent: req.headers.get("user-agent")?.slice(0, 500) ?? null,
      ip_country: req.headers.get("x-vercel-ip-country") || null,
      resend_contact_id: contactId,
    },
    { onConflict: "email", ignoreDuplicates: true }, // idempotent: re-submits are a no-op
  );
  if (error) {
    return NextResponse.json(
      { ok: false, error: "Could not save your signup. Please try again." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}

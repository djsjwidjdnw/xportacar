import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { registerBuyer } from "@/lib/auth/registerBuyer";

export const runtime = "nodejs";

// Buyer registration for the mobile app (it can't invoke server actions). Uses
// a stateless anon client so signUp triggers Supabase's confirmation email; the
// mobile app then uploads KYC docs to /api/kyc/upload with the returned token
// and signs in (signInWithPassword) once the email is confirmed.
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return NextResponse.json({ ok: false, error: "Server not configured." }, { status: 500 });
  }

  const supabase = createSupabaseClient(url, anonKey, { auth: { persistSession: false } });
  const res = await registerBuyer(supabase, {
    email: String(body.email ?? ""),
    password: String(body.password ?? ""),
    fullName: String(body.fullName ?? body.full_name ?? ""),
    companyName: String(body.companyName ?? body.company_name ?? ""),
    country: String(body.country ?? ""),
    isBusiness: body.isBusiness === true || body.is_business === true,
    locale: typeof body.locale === "string" ? body.locale : undefined,
  });

  if (!res.ok) return NextResponse.json(res, { status: 400 });
  return NextResponse.json(res);
}

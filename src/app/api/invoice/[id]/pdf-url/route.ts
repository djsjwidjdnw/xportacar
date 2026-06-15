// Mint a signed, login-free PDF URL for the mobile app.
// GET /api/invoice/:id/pdf-url   Authorization: Bearer <supabase access token>
// → { url } valid for 7 days. The mobile app opens/shares this URL directly
// (mobile Safari has no session cookie, so it can't use the session-gated route).
import type { NextRequest } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { signedInvoicePdfUrl } from "@/lib/invoice/signedUrl";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return Response.json({ error: "unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: { user }, error } = await admin.auth.getUser(token);
  if (error || !user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { data: inv } = await admin
    .from("invoices").select("id, buyer_id").eq("id", id).maybeSingle();
  if (!inv || (inv as { buyer_id: string }).buyer_id !== user.id) {
    return Response.json({ error: "not found" }, { status: 404 });
  }

  // Pin the host to the request origin (e.g. https://xportacar.com) so the URL
  // is always absolute and openable, regardless of NEXT_PUBLIC_SITE_URL.
  return Response.json({ url: signedInvoicePdfUrl(id, { origin: req.nextUrl.origin }) });
}

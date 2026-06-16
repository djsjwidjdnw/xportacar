// Mint a signed, login-free PDF URL for the mobile app.
// GET /api/invoice/:id/pdf-url   Authorization: Bearer <supabase access token>
// → { url } valid for 7 days. The mobile app opens/shares this URL directly
// (mobile Safari has no session cookie, so it can't use the session-gated route).
import type { NextRequest } from "next/server";

import { createBearerClient } from "@/lib/supabase/bearer";
import { signedInvoicePdfUrl } from "@/lib/invoice/signedUrl";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const authHeader = req.headers.get("authorization");
  // Token-scoped client (anon key + bearer token) — RLS-scoped to the buyer; no
  // service-role key needed (it was found stale in prod, causing 401s).
  const db = createBearerClient(authHeader);
  console.info(`[pdf-url] invoice=${id} authHeader=${authHeader ? "present" : "MISSING"}`);
  if (!db) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { data: { user }, error } = await db.auth.getUser();
  if (error || !user) {
    console.warn(`[pdf-url] getUser failed: ${error?.message ?? "no user"}`);
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  // Ownership: RLS scopes this SELECT to the buyer's own invoices.
  const { data: inv } = await db
    .from("invoices").select("id, buyer_id").eq("id", id).maybeSingle();
  if (!inv || (inv as { buyer_id: string }).buyer_id !== user.id) {
    return Response.json({ error: "not found" }, { status: 404 });
  }
  console.info(`[pdf-url] minting signed url for user=${user.id}`);

  // Pin the host to the request origin (e.g. https://xportacar.com) so the URL
  // is always absolute and openable, regardless of NEXT_PUBLIC_SITE_URL.
  return Response.json({ url: signedInvoicePdfUrl(id, { origin: req.nextUrl.origin }) });
}

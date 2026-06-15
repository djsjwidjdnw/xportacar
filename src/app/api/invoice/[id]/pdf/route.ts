// Downloadable PDF invoice, rendered by the shared renderInvoicePdf().
// GET /api/invoice/:id/pdf?token=&shipping=&shippingEur=&tuvEur=&download=1
//
// Access: a valid signed ?token= grants public access (mobile Safari / email
// recipients have no session cookie). Otherwise it falls back to session auth,
// so a logged-in buyer on the web keeps working and an anonymous request with
// no token and no session gets 401.
import type { NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { renderInvoicePdf } from "@/lib/invoice/pdf";
import { verifyInvoiceToken } from "@/lib/invoice/signedUrl";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const sp = req.nextUrl.searchParams;

  // A valid signed token authorizes THIS invoice without a session.
  const tokenOk = verifyInvoiceToken(id, sp.get("token"));
  if (!tokenOk) {
    // No token → require a session (ownership still enforced by RLS inside
    // renderInvoicePdf, which uses the RLS-scoped server client in this branch).
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response("Unauthorized", { status: 401 });
  }

  const result = await renderInvoicePdf(id, {
    // Token-authed requests have no session, so read via the service-role client
    // (the token already proved authorization for this invoice).
    useAdminClient: tokenOk,
    shippingLabel: sp.get("shipping") ?? undefined,
    shippingEur: sp.get("shippingEur") != null ? Number(sp.get("shippingEur")) : undefined,
    tuvEur: sp.get("tuvEur") != null ? Number(sp.get("tuvEur")) : undefined,
  });
  if (!result) return new Response("Not found", { status: 404 });

  // Default INLINE (preview in browser / in-app webview); ?download=1 forces save.
  const disposition = sp.get("download") === "1" ? "attachment" : "inline";
  return new Response(new Uint8Array(result.buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="${result.filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

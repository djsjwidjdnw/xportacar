// Real downloadable PDF invoice. The PDF is rendered by the shared
// renderInvoicePdf() (src/lib/invoice/pdf.ts) so the exact same document can be
// attached to the invoice email. GET /api/invoice/:id/pdf?shipping=&shippingEur=&tuvEur=&download=1
import type { NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { renderInvoicePdf } from "@/lib/invoice/pdf";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  // Auth gate; ownership is enforced by RLS inside renderInvoicePdf (it uses the
  // same RLS-scoped server client, so a buyer can only render their own invoice).
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const sp = req.nextUrl.searchParams;
  const result = await renderInvoicePdf(id, {
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

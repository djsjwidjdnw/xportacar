// Finalize a buyer's shipping + extras selection from the MOBILE app, then send
// the invoice email. This is the mobile equivalent of the web server action
// finalizeInvoiceShippingAction — both call the same finalizeInvoiceAndEmail()
// core, so the email fires identically regardless of platform.
//
// POST /api/invoice/:id/finalize   Authorization: Bearer <supabase access token>
// body: { shippingMethod, shippingEur, distanceKm, shippingLine1, shippingLine2,
//         shippingCity, shippingPostalCode, shippingCountry, shippingLatitude,
//         shippingLongitude, extras: [{ name, price_eur }] }
import type { NextRequest } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { finalizeInvoiceAndEmail } from "@/lib/invoice/finalize";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: { user }, error: uErr } = await admin.auth.getUser(token);
  if (uErr || !user) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const { data: inv } = await admin
    .from("invoices").select("id, buyer_id").eq("id", id).maybeSingle();
  if (!inv || (inv as { buyer_id: string }).buyer_id !== user.id) {
    return Response.json({ ok: false, error: "not found" }, { status: 404 });
  }

  // deno-lint-ignore no-explicit-any
  const body = (await req.json().catch(() => ({}))) as any;
  const method = body.shippingMethod === "door_to_door" ? "door_to_door" : "standard";
  const extras = Array.isArray(body.extras)
    ? body.extras
        .filter((e: unknown) => e && typeof e === "object")
        .map((e: { name?: unknown; price_eur?: unknown }) => ({
          name: String(e.name ?? "Extra"),
          price_eur: Number(e.price_eur) || 0,
        }))
    : [];
  const num = (v: unknown) => (v == null || v === "" ? null : Number(v));

  const res = await finalizeInvoiceAndEmail({
    invoiceId: id,
    shippingMethod: method,
    shippingEur: Number(body.shippingEur) || 0,
    distanceKm: num(body.distanceKm),
    shippingLine1: body.shippingLine1 ?? null,
    shippingLine2: body.shippingLine2 ?? null,
    shippingCity: body.shippingCity ?? null,
    shippingPostalCode: body.shippingPostalCode ?? null,
    shippingCountry: body.shippingCountry ?? null,
    shippingLatitude: num(body.shippingLatitude),
    shippingLongitude: num(body.shippingLongitude),
    extras,
  });

  const status = res.ok ? 200 : 400;
  return Response.json(res, { status });
}

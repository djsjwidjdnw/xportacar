"use server";

// Counter-offer review actions for admins.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function reviewCounterOfferAction(input: {
  offerId: string;
  decision: "accepted" | "rejected";
  note?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !["admin", "superadmin"].includes(profile.role)) {
    return { ok: false, error: "Admin only." };
  }

  // Load the offer (need amount + auction).
  const { data: offer } = await supabase
    .from("counter_offers")
    .select("id, auction_id, bidder_id, amount_eur, status")
    .eq("id", input.offerId)
    .single();
  if (!offer) return { ok: false, error: "Offer not found." };
  if (offer.status !== "pending") return { ok: false, error: "Offer already reviewed." };

  const admin = createAdminClient();

  // Mark the offer reviewed.
  await admin
    .from("counter_offers")
    .update({
      status:      input.decision,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", input.offerId);

  // If accepted, close the auction at the offer price.
  if (input.decision === "accepted") {
    const { data: auction } = await admin
      .from("auctions")
      .select("vehicle_id")
      .eq("id", offer.auction_id)
      .single();

    await admin
      .from("auctions")
      .update({
        status:          "sold",
        winner_id:       offer.bidder_id,
        end_time:        new Date().toISOString(),
        current_bid_eur: offer.amount_eur,
      })
      .eq("id", offer.auction_id);

    if (auction?.vehicle_id) {
      await admin
        .from("vehicles")
        .update({ status: "sold" })
        .eq("id", auction.vehicle_id);
    }

    // Notify bidder they won via counter-offer.
    await admin.from("notifications").insert({
      user_id: offer.bidder_id,
      type:    "auction_won",
      title:   "Counter-offer accepted",
      body:    `Your offer of €${offer.amount_eur.toLocaleString("en-GB")} was accepted. The auction has been closed.`,
      data:    { auction_id: offer.auction_id, amount_eur: offer.amount_eur },
    });
  } else {
    await admin.from("notifications").insert({
      user_id: offer.bidder_id,
      type:    "status_update",
      title:   "Counter-offer declined",
      body:    `Your counter-offer of €${offer.amount_eur.toLocaleString("en-GB")} was not accepted. Continue bidding in the auction.`,
      data:    { auction_id: offer.auction_id },
    });
  }

  revalidatePath("/admin/counter-offers");
  revalidatePath(`/auction/${offer.auction_id}`);
  return { ok: true };
}

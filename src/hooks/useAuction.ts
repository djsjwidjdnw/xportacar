"use client";

// Realtime auction subscription:  hydrates with server-provided data, then
// listens to bids/auctions tables on Supabase Realtime.

import { useCallback, useEffect, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/client";
import type { Auction, BidWithBidder } from "@/types";

export function useAuction({
  initialAuction,
  initialBids,
}: {
  initialAuction: Auction;
  initialBids: BidWithBidder[];
}) {
  const [auction, setAuction] = useState<Auction>(initialAuction);
  const [bids, setBids] = useState<BidWithBidder[]>(initialBids);

  const fetchBidWithBidder = useCallback(async (id: string) => {
    const supabase = createClient();
    const { data } = await supabase
      .from("bids")
      .select(`*, bidder:profiles!bidder_id(id, full_name, company_name, country, avatar_url)`)
      .eq("id", id)
      .single();
    return data as BidWithBidder | null;
  }, []);

  useEffect(() => {
    const supabase = createClient();
    const channel: RealtimeChannel = supabase
      .channel(`auction-${initialAuction.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "bids",
          filter: `auction_id=eq.${initialAuction.id}`,
        },
        async (payload) => {
          const newBid = payload.new as { id: string };
          const enriched = await fetchBidWithBidder(newBid.id);
          if (!enriched) return;
          setBids((prev) =>
            prev.some((b) => b.id === enriched.id) ? prev : [enriched, ...prev]);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "auctions",
          filter: `id=eq.${initialAuction.id}`,
        },
        (payload) => {
          setAuction((prev) => ({ ...prev, ...(payload.new as Partial<Auction>) }));
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [initialAuction.id, fetchBidWithBidder]);

  return { auction, bids, setAuction };
}

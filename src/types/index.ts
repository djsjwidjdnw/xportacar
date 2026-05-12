// Shared application types — re-exports DB types and adds composite shapes
// for joined queries used by the marketplace, auction page, etc.

export * from "@/lib/supabase/types";

import type { Auction, Bid, Profile, Vehicle, VehicleDamage, VehiclePhoto } from "@/lib/supabase/types";

export interface VehicleWithMedia extends Vehicle {
  vehicle_photos: VehiclePhoto[];
  vehicle_damages: VehicleDamage[];
  auctions: Auction[];
}

export interface AuctionWithVehicle extends Auction {
  vehicle: VehicleWithMedia;
}

export interface BidWithBidder extends Bid {
  bidder: Pick<Profile, "id" | "full_name" | "company_name" | "country" | "avatar_url">;
}

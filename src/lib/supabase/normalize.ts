// PostgREST returns 1-to-1 embedded relationships as a single object (or null),
// not as a 1-element array.  In our schema, `auctions.vehicle_id` has a UNIQUE
// constraint, so when we embed `auctions` from a `vehicles` query we get
// `Auction | null` rather than `Auction[]`.
//
// All page code expects the array form, so we normalise once on the boundary.

import type { Auction, Vehicle, VehicleDamage, VehiclePhoto, VehicleWithMedia } from "@/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function arrayify<T>(value: T | T[] | null | undefined): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeVehicleRow(row: any): VehicleWithMedia {
  return {
    ...(row as Vehicle),
    vehicle_photos:  arrayify<VehiclePhoto>(row.vehicle_photos),
    vehicle_damages: arrayify<VehicleDamage>(row.vehicle_damages),
    auctions:        arrayify<Auction>(row.auctions),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeVehicleRows(rows: any[] | null | undefined): VehicleWithMedia[] {
  return (rows ?? []).map(normalizeVehicleRow);
}

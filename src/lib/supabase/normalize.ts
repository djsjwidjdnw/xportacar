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

export type NormalizeOpts = {
  /**
   * Drop seller identity/contact (seller_name / seller_phone / seller_email)
   * from the returned object. Buyer-facing surfaces MUST pass this so seller
   * PII never reaches a client component / RSC payload. Admin/inspector
   * surfaces omit it and keep full access.
   */
  stripSeller?: boolean;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeVehicleRow(row: any, opts?: NormalizeOpts): VehicleWithMedia {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { seller_name, seller_phone, seller_email, ...rest } = row;
  const base = opts?.stripSeller ? rest : row;
  return {
    ...(base as Vehicle),
    vehicle_photos:  arrayify<VehiclePhoto>(row.vehicle_photos),
    vehicle_damages: arrayify<VehicleDamage>(row.vehicle_damages),
    auctions:        arrayify<Auction>(row.auctions),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeVehicleRows(rows: any[] | null | undefined, opts?: NormalizeOpts): VehicleWithMedia[] {
  return (rows ?? []).map((r) => normalizeVehicleRow(r, opts));
}

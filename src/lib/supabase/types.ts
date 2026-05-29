// Hand-written Database type — replace with `supabase gen types typescript` output once
// the project is linked.  Mirrors supabase/migrations/001_initial_schema.sql.

export type UserRole = "buyer" | "admin" | "inspector" | "superadmin";
export type KycStatus = "pending" | "verified" | "rejected";
export type FuelType = "petrol" | "diesel" | "hybrid" | "electric";
export type TransmissionType = "automatic" | "manual";
export type VehicleStatus =
  | "draft"
  | "inspection_scheduled"
  | "inspected"
  | "pending_review"
  | "changes_requested"
  | "listed"
  | "in_auction"
  | "sold"
  | "payment_pending"
  | "paid"
  | "collected"
  | "shipped"
  | "delivered";
export type PhotoCategory =
  | "exterior" | "interior" | "engine" | "undercarriage" | "documents" | "damage" | "paint_thickness";
export type DamageSeverity = "cosmetic" | "minor" | "moderate" | "major";
export type AuctionStatus =
  | "scheduled" | "active" | "ended" | "sold" | "cancelled";
export type NotificationType =
  | "outbid" | "auction_won" | "auction_ending"
  | "new_vehicle" | "payment_due" | "status_update";
export type CounterOfferStatus = "pending" | "accepted" | "rejected" | "expired";
export type InvoiceStatus      = "pending" | "paid" | "cancelled";
export type KycDocType         = "trade_license" | "id_document" | "utility_bill" | "other";
export type KycReviewStatus    = "pending" | "approved" | "rejected";
export type DevicePlatform     = "ios" | "android" | "web";

export interface Profile {
  id: string;
  role: UserRole;
  company_name: string | null;
  company_registration: string | null;
  phone: string | null;
  country: string | null;
  language: string;
  kyc_status: KycStatus;
  avatar_url: string | null;
  full_name: string | null;
  email: string | null;
  created_at: string;
  updated_at: string;
}

export interface Vehicle {
  id: string;
  vin: string;
  make: string;
  model: string;
  year: number;
  mileage_km: number;
  fuel_type: FuelType;
  transmission: TransmissionType;
  drivetrain: string | null;
  engine: string | null;
  exterior_color: string | null;
  interior_color: string | null;
  body_type: string | null;
  first_registration: string | null;
  location_city: string;
  location_country: string;
  status: VehicleStatus;
  seller_name: string;
  seller_phone: string;
  seller_email: string | null;
  inspector_id: string | null;
  inspection_date: string | null;
  inspection_notes: string | null;
  review_notes: string | null;
  listed_price_eur: number | null;
  reserve_price_eur: number | null;
  buy_now_price_eur: number | null;
  description: string | null;
  features: string[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface VehiclePhoto {
  id: string;
  vehicle_id: string;
  url: string;
  category: PhotoCategory;
  sort_order: number;
  caption: string | null;
  created_at: string;
}

export interface VehicleDamage {
  id: string;
  vehicle_id: string;
  location: string;
  description: string;
  severity: DamageSeverity;
  photo_url: string | null;
  created_at: string;
}

export interface Auction {
  id: string;
  vehicle_id: string;
  status: AuctionStatus;
  start_time: string;
  end_time: string;
  starting_price_eur: number;
  reserve_price_eur: number | null;
  buy_now_price_eur: number | null;
  current_bid_eur: number | null;
  bid_count: number;
  bidder_count: number;
  winner_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Bid {
  id: string;
  auction_id: string;
  bidder_id: string;
  amount_eur: number;
  is_proxy: boolean;
  proxy_max_eur: number | null;
  created_at: string;
}

export interface WatchlistItem {
  id: string;
  user_id: string;
  vehicle_id: string;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  read: boolean;
  created_at: string;
}

export interface CounterOffer {
  id: string;
  auction_id: string;
  bidder_id: string;
  amount_eur: number;
  status: CounterOfferStatus;
  message: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  expires_at: string | null;
  created_at: string;
}

export interface Invoice {
  id: string;
  auction_id: string;
  buyer_id: string;
  vehicle_id: string;
  amount_eur: number;
  platform_fee_eur: number;
  total_eur: number;
  status: InvoiceStatus;
  invoice_number: string | null;
  stripe_session_id: string | null;
  paid_at: string | null;
  created_at: string;
}

export interface SavedSearch {
  id: string;
  user_id: string;
  name: string;
  filters: Record<string, unknown>;
  notify: boolean;
  created_at: string;
}

export interface ShippingQuote {
  id: string;
  vehicle_id: string;
  buyer_id: string | null;
  destination: string;
  cost_eur: number;
  transit_days: number;
  carrier: string | null;
  created_at: string;
}

export interface KycSubmission {
  id: string;
  user_id: string;
  document_type: KycDocType;
  file_url: string;
  status: KycReviewStatus;
  reviewed_by: string | null;
  reviewer_note: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface PushToken {
  id: string;
  user_id: string;
  token: string;
  platform: DevicePlatform;
  device_name: string | null;
  last_seen: string;
  created_at: string;
}

// Minimal supabase-js compatible Database shape.
type RowInsert<T> = Partial<T>;
type RowUpdate<T> = Partial<T>;

export interface Database {
  public: {
    Tables: {
      profiles:        { Row: Profile;       Insert: RowInsert<Profile>;       Update: RowUpdate<Profile>;       Relationships: [] };
      vehicles:        { Row: Vehicle;       Insert: RowInsert<Vehicle>;       Update: RowUpdate<Vehicle>;       Relationships: [] };
      vehicle_photos:  { Row: VehiclePhoto;  Insert: RowInsert<VehiclePhoto>;  Update: RowUpdate<VehiclePhoto>;  Relationships: [] };
      vehicle_damages: { Row: VehicleDamage; Insert: RowInsert<VehicleDamage>; Update: RowUpdate<VehicleDamage>; Relationships: [] };
      auctions:        { Row: Auction;       Insert: RowInsert<Auction>;       Update: RowUpdate<Auction>;       Relationships: [] };
      bids:            { Row: Bid;           Insert: RowInsert<Bid>;           Update: RowUpdate<Bid>;           Relationships: [] };
      watchlist:       { Row: WatchlistItem; Insert: RowInsert<WatchlistItem>; Update: RowUpdate<WatchlistItem>; Relationships: [] };
      notifications:   { Row: Notification;  Insert: RowInsert<Notification>;  Update: RowUpdate<Notification>;  Relationships: [] };
      counter_offers:  { Row: CounterOffer;  Insert: RowInsert<CounterOffer>;  Update: RowUpdate<CounterOffer>;  Relationships: [] };
      invoices:        { Row: Invoice;       Insert: RowInsert<Invoice>;       Update: RowUpdate<Invoice>;       Relationships: [] };
      saved_searches:  { Row: SavedSearch;   Insert: RowInsert<SavedSearch>;   Update: RowUpdate<SavedSearch>;   Relationships: [] };
      shipping_quotes: { Row: ShippingQuote; Insert: RowInsert<ShippingQuote>; Update: RowUpdate<ShippingQuote>; Relationships: [] };
      kyc_submissions: { Row: KycSubmission; Insert: RowInsert<KycSubmission>; Update: RowUpdate<KycSubmission>; Relationships: [] };
      push_tokens:     { Row: PushToken;     Insert: RowInsert<PushToken>;     Update: RowUpdate<PushToken>;     Relationships: [] };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      user_role: UserRole;
      kyc_status: KycStatus;
      fuel_type: FuelType;
      transmission_type: TransmissionType;
      vehicle_status: VehicleStatus;
      photo_category: PhotoCategory;
      damage_severity: DamageSeverity;
      auction_status: AuctionStatus;
      notification_type: NotificationType;
    };
  };
}

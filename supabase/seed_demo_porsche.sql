-- One-off, re-runnable demo car for end-to-end testing (Buy Now + payment proof).
-- Adds a single Porsche 911 with a LIVE auction. Safe to re-run: it deletes the
-- prior demo Porsche (by fixed id and by VIN) before inserting. Touches nothing else.
--
-- Photos use hosted stock URLs exactly like the existing demo data (seed.sql),
-- so no storage upload is required.
--
-- IDs use the demo prefix (11111111-0001 / 22222222-0001) so the existing
-- cleanup_demo_data.sql will also remove this car when you go live.
begin;

-- ---- Clean up any prior demo Porsche (idempotent) -------------------
delete from public.bids
  where auction_id in (
    select id from public.auctions
    where vehicle_id = '11111111-0001-0000-0000-000000000999'
       or vehicle_id in (select id from public.vehicles where vin = 'WP0AB2A99NS227001')
  );
delete from public.auctions
  where vehicle_id = '11111111-0001-0000-0000-000000000999'
     or vehicle_id in (select id from public.vehicles where vin = 'WP0AB2A99NS227001');
delete from public.vehicle_photos
  where vehicle_id = '11111111-0001-0000-0000-000000000999'
     or vehicle_id in (select id from public.vehicles where vin = 'WP0AB2A99NS227001');
delete from public.vehicle_damages
  where vehicle_id = '11111111-0001-0000-0000-000000000999'
     or vehicle_id in (select id from public.vehicles where vin = 'WP0AB2A99NS227001');
delete from public.vehicles
  where id = '11111111-0001-0000-0000-000000000999'
     or vin = 'WP0AB2A99NS227001';

-- ---- Vehicle --------------------------------------------------------
insert into public.vehicles (
  id, vin, make, model, year, mileage_km, fuel_type, transmission,
  drivetrain, engine, exterior_color, interior_color, body_type,
  first_registration, location_city, location_country, status,
  seller_name, seller_phone, seller_email,
  listed_price_eur, reserve_price_eur, buy_now_price_eur,
  description, features
) values (
  '11111111-0001-0000-0000-000000000999',
  'WP0AB2A99NS227001', 'Porsche', '911 Carrera S', 2022, 25000,
  'petrol', 'automatic', 'RWD', '3.0L Twin-Turbo Flat-6 (8-speed PDK)',
  'Guards Red', 'Black Leather', 'Coupe',
  '2022-05-10', 'Dubai', 'UAE', 'in_auction',
  'Demo Seller', '+971 50 000 0000', 'demo.seller@example.ae',
  95000, 90000, 110000,
  'Demo vehicle for end-to-end testing. 992-generation 911 Carrera S in Guards Red with Sport Chrono, PASM, BOSE surround and full Porsche service history. Single owner, GCC specification.',
  array['Sport Chrono Package','PASM','Sport Exhaust','BOSE Surround','Adaptive Sport Seats Plus','LED Matrix Headlights','20/21" Carrera S Wheels','Apple CarPlay']
);

-- ---- Photos (9: exterior/interior/engine/undercarriage) -------------
insert into public.vehicle_photos (vehicle_id, url, category, sort_order, caption) values
('11111111-0001-0000-0000-000000000999','https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=1600&q=80','exterior',0,'Guards Red — front three-quarter'),
('11111111-0001-0000-0000-000000000999','https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=1600&q=80','exterior',1,'Side profile'),
('11111111-0001-0000-0000-000000000999','https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?w=1600&q=80','exterior',2,'Rear three-quarter'),
('11111111-0001-0000-0000-000000000999','https://images.unsplash.com/photo-1568844293986-8d0400bd4745?w=1600&q=80','exterior',3,'Front'),
('11111111-0001-0000-0000-000000000999','https://images.unsplash.com/photo-1542362567-b07e54358753?w=1600&q=80','exterior',4,'Rolling shot'),
('11111111-0001-0000-0000-000000000999','https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=1600&q=80','interior',5,'Cockpit'),
('11111111-0001-0000-0000-000000000999','https://images.unsplash.com/photo-1503736334956-4c8f8e92946d?w=1600&q=80','interior',6,'PCM dashboard'),
('11111111-0001-0000-0000-000000000999','https://images.unsplash.com/photo-1555215695-3004980ad54e?w=1600&q=80','engine',7,'Twin-turbo flat-6'),
('11111111-0001-0000-0000-000000000999','https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=1600&q=80','undercarriage',8,'Underbody');

-- ---- Damages (minor, with placeholder photos) -----------------------
insert into public.vehicle_damages (vehicle_id, location, description, severity, photo_url) values
('11111111-0001-0000-0000-000000000999','Rear Bumper','Small scratch ~5cm on rear bumper, paint intact — cosmetic only','cosmetic','https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?w=1200&q=80'),
('11111111-0001-0000-0000-000000000999','Hood','Stone chip on leading edge of hood from highway driving','minor','https://images.unsplash.com/photo-1556189250-72ba954cfc2b?w=1200&q=80');

-- ---- Paint thickness reading (guarded so it skips if the enum value
--      'paint_thickness' from migration 006 hasn't been applied yet) ---
do $$
begin
  if exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'photo_category' and e.enumlabel = 'paint_thickness'
  ) then
    insert into public.vehicle_photos (vehicle_id, url, category, sort_order, caption)
    values ('11111111-0001-0000-0000-000000000999',
            'https://images.unsplash.com/photo-1503736334956-4c8f8e92946d?w=1200&q=80',
            'paint_thickness', 50, 'Paint thickness gauge reading');
  end if;
end $$;

-- ---- LIVE auction: ends in 1 hour -----------------------------------
insert into public.auctions (
  id, vehicle_id, status, start_time, end_time,
  starting_price_eur, reserve_price_eur, buy_now_price_eur, current_bid_eur
) values (
  '22222222-0001-0000-0000-000000000999',
  '11111111-0001-0000-0000-000000000999',
  'active', now() - interval '1 minute', now() + interval '1 hour',
  80000, 90000, 110000, null
);

commit;

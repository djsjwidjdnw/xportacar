-- =====================================================================
-- XportACar — Seed data
-- 12 UAE vehicles · 3 demo users · 6 active auctions with bid history
-- =====================================================================
-- The seed assumes these auth.users have been created first
--   admin@xportacar.com   / Demo!1234   role=admin
--   buyer@xportacar.com   / Demo!1234   role=buyer
--   inspector@xportacar.com / Demo!1234 role=inspector
-- See README/CLAUDE.md for the supabase auth admin call to create them,
-- or run `supabase db reset --seed` after creating users via dashboard.
--
-- This file is idempotent — re-running clears existing seeded rows first.
-- =====================================================================

-- Clean slate (only data inserted by this seed) ---------------------
truncate table public.bids,
              public.watchlist,
              public.notifications,
              public.auctions,
              public.vehicle_damages,
              public.vehicle_photos,
              public.vehicles
        restart identity cascade;

-- =====================================================================
-- Demo profiles  (link to auth users by predictable email lookup)
-- =====================================================================
do $$
declare
  v_admin uuid;
  v_buyer uuid;
  v_inspector uuid;
  v_buyer2 uuid;
  v_buyer3 uuid;
begin
  select id into v_admin     from auth.users where email = 'admin@xportacar.com';
  select id into v_buyer     from auth.users where email = 'buyer@xportacar.com';
  select id into v_inspector from auth.users where email = 'inspector@xportacar.com';
  select id into v_buyer2    from auth.users where email = 'buyer2@xportacar.com';
  select id into v_buyer3    from auth.users where email = 'buyer3@xportacar.com';

  if v_admin is not null then
    update public.profiles set
      role         = 'admin',
      full_name    = 'Sarah Al-Mansouri',
      company_name = 'XportACar Operations',
      country      = 'UAE',
      kyc_status   = 'verified',
      phone        = '+971 50 123 4567'
    where id = v_admin;
  end if;

  if v_buyer is not null then
    update public.profiles set
      role         = 'buyer',
      full_name    = 'Klaus Weber',
      company_name = 'AutoHaus Weber GmbH',
      company_registration = 'HRB 84320 B',
      country      = 'Germany',
      kyc_status   = 'verified',
      language     = 'de',
      phone        = '+49 30 9876 5432'
    where id = v_buyer;
  end if;

  if v_inspector is not null then
    update public.profiles set
      role         = 'inspector',
      full_name    = 'Mohammed Al-Hashimi',
      country      = 'UAE',
      kyc_status   = 'verified',
      phone        = '+971 55 987 6543'
    where id = v_inspector;
  end if;

  if v_buyer2 is not null then
    update public.profiles set
      role = 'buyer', full_name = 'Pierre Dubois',
      company_name = 'Garage Dubois SARL', country = 'France',
      kyc_status = 'verified', language = 'fr'
    where id = v_buyer2;
  end if;

  if v_buyer3 is not null then
    update public.profiles set
      role = 'buyer', full_name = 'Marco Rossi',
      company_name = 'AutoImport Milano S.r.l.', country = 'Italy',
      kyc_status = 'verified', language = 'en'
    where id = v_buyer3;
  end if;
end $$;

-- =====================================================================
-- Vehicles (12)  with deterministic UUIDs so we can reference them
-- =====================================================================
insert into public.vehicles (
  id, vin, make, model, year, mileage_km, fuel_type, transmission,
  drivetrain, engine, exterior_color, interior_color, body_type,
  first_registration, status,
  seller_name, seller_phone, seller_email,
  listed_price_eur, reserve_price_eur, buy_now_price_eur,
  description, features
) values
-- 1 Mercedes-Benz GLE 450
('11111111-0001-0000-0000-000000000001',
 'WDC1671171A123451', 'Mercedes-Benz', 'GLE 450 4MATIC', 2022, 38500,
 'petrol', 'automatic', 'AWD', '3.0L Inline-6 Turbo Mild Hybrid',
 'Obsidian Black', 'Macchiato Beige Nappa', 'SUV',
 '2022-03-14', 'in_auction',
 'Ahmed Al-Suwaidi', '+971 50 111 2233', 'ahmed.s@example.ae',
 68500, 65000, 78000,
 'Single owner from new, full Mercedes-Benz Emirates Motor Company service history. AMG Line exterior and interior, panoramic sunroof, Burmester surround sound, head-up display, 360° camera. Stored in covered parking, never off-road.',
 array['AMG Line','Panoramic Sunroof','Burmester Audio','Head-up Display','360° Camera','Heated & Ventilated Seats','Air Suspension','Keyless Go','Apple CarPlay','Android Auto']),

-- 2 BMW X5 xDrive40i M Sport
('11111111-0001-0000-0000-000000000002',
 'WBAJU2C56KLB12345', 'BMW', 'X5 xDrive40i M Sport', 2023, 22100,
 'petrol', 'automatic', 'AWD', '3.0L Inline-6 TwinPower Turbo',
 'Carbon Black Metallic', 'Cognac Vernasca Leather', 'SUV',
 '2023-06-02', 'in_auction',
 'Fatima Al-Mazrouei', '+971 56 222 3344', 'fatima.m@example.ae',
 79900, 76000, 89000,
 'BMW Premium Selection certified. M Sport package, 22\" M wheels, laser headlights, Harman Kardon, soft-close doors, gesture control. Two keys, original tyres. GCC specification.',
 array['M Sport Package','Laser Headlights','Harman Kardon','Soft-close Doors','Gesture Control','Heads-up Display','Adaptive Cruise','Wireless Charging']),

-- 3 Porsche Cayenne S
('11111111-0001-0000-0000-000000000003',
 'WP1AB2A20PLA12345', 'Porsche', 'Cayenne S', 2023, 18750,
 'petrol', 'automatic', 'AWD', '2.9L V6 Twin-Turbo',
 'Carrara White Metallic', 'Black/Bordeaux Red Two-Tone Leather', 'SUV',
 '2023-09-19', 'in_auction',
 'Khalid Bin Rashid', '+971 52 333 4455', 'khalid.r@example.ae',
 102500, 96000, 118000,
 'Porsche Approved Used eligible. Sport Chrono Package, PASM adaptive air suspension, sport exhaust, Bose surround. Configured with significant options — original sticker over AED 520k.',
 array['Sport Chrono','PASM Adaptive Air Suspension','Sport Exhaust','Bose Audio','Power Steering Plus','Lane Change Assist','Panoramic Roof','21\" Wheels']),

-- 4 Range Rover Sport HSE Dynamic
('11111111-0001-0000-0000-000000000004',
 'SALWA2BK7PA123456', 'Land Rover', 'Range Rover Sport HSE Dynamic', 2022, 41200,
 'petrol', 'automatic', 'AWD', '3.0L Ingenium I6 MHEV',
 'Santorini Black', 'Ebony Windsor Leather', 'SUV',
 '2022-01-25', 'in_auction',
 'Hassan Al-Falasi', '+971 50 444 5566', 'hassan.f@example.ae',
 88900, 84000, 99000,
 'Comprehensive service history with Al Tayer Motors. Two-tier 22\" wheels, Meridian sound, gesture tailgate, panoramic roof. Recent full service and four new tyres.',
 array['Meridian Sound','Pano Roof','Heated Steering Wheel','Cooled Seats','Adaptive Dynamics','Off-Road Pack','22\" Wheels']),

-- 5 Audi Q8 55 TFSI quattro
('11111111-0001-0000-0000-000000000005',
 'WA1AVAF18PD123457', 'Audi', 'Q8 55 TFSI quattro S line', 2023, 15400,
 'petrol', 'automatic', 'AWD', '3.0L V6 TFSI MHEV',
 'Glacier White Metallic', 'Black Valcona Leather', 'SUV',
 '2023-04-11', 'in_auction',
 'Aisha Al-Nuaimi', '+971 54 555 6677', 'aisha.n@example.ae',
 86500, 82000, 96000,
 'Single owner, agency maintained at Audi Abu Dhabi. S line exterior, virtual cockpit plus, B&O sound, matrix LED headlights with laser high beam, head-up display.',
 array['S line','Matrix LED Laser','Virtual Cockpit Plus','Bang & Olufsen','Head-up Display','Adaptive Air Suspension','21\" Wheels','Soft-close Doors']),

-- 6 Toyota Land Cruiser VXR 300
('11111111-0001-0000-0000-000000000006',
 'JTMHV05J104123458', 'Toyota', 'Land Cruiser VXR 300', 2023, 27800,
 'petrol', 'automatic', '4WD', '3.5L V6 Twin-Turbo',
 'Pearl White', 'Tan Leather', 'SUV',
 '2023-02-18', 'in_auction',
 'Salem Al-Marzouqi', '+971 55 666 7788', 'salem.m@example.ae',
 91900, 88000, 102000,
 'Top of the line VXR with full options. Multi-Terrain Select, Crawl Control, JBL premium audio, rear seat entertainment, refrigerator console. GCC, full Al-Futtaim service history.',
 array['Multi-Terrain Select','Crawl Control','JBL Premium','Rear Entertainment','Refrigerator Console','Cool Box','22\" Wheels','Hydraulic Suspension']),

-- 7 Lexus LX 600 Ultra Luxury
('11111111-0001-0000-0000-000000000007',
 'JTJHY00W6P4123459', 'Lexus', 'LX 600 Ultra Luxury', 2022, 32400,
 'petrol', 'automatic', '4WD', '3.5L V6 Twin-Turbo',
 'Sonic Quartz', 'Rich Cream Semi-Aniline Leather', 'SUV',
 '2022-08-07', 'in_auction',
 'Reem Al-Qassimi', '+971 50 777 8899', 'reem.q@example.ae',
 124500, 119000, 138000,
 'Four-seat Ultra Luxury executive configuration. Mark Levinson 25-speaker, rear ottoman seats, refrigerator, dual rear entertainment screens. As-new condition.',
 array['Ultra Luxury 4-Seat','Mark Levinson 25-Speaker','Rear Ottoman','Refrigerator','Dual Rear Screens','Massage Seats','Pano Roof','Active Height Control']),

-- 8 Nissan Patrol Platinum LE
('11111111-0001-0000-0000-000000000008',
 'JN8AY2NF2P9123460', 'Nissan', 'Patrol Platinum LE', 2023, 19600,
 'petrol', 'automatic', '4WD', '5.6L V8 Endurance',
 'Galaxy Black', 'Almond Quilted Leather', 'SUV',
 '2023-05-24', 'in_auction',
 'Omar Al-Shamsi', '+971 56 888 9900', 'omar.s@example.ae',
 76900, 73000, 86000,
 'Top-trim Platinum LE with all factory options. Hydraulic body motion control, around view monitor, BOSE 13-speaker, second row captain chairs.',
 array['Platinum LE','Hydraulic Body Motion','Around View Monitor','BOSE 13-Speaker','Captain Chairs','Cool Box','Sunroof','22\" Wheels']),

-- 9 Mercedes-Benz S 500 4MATIC
('11111111-0001-0000-0000-000000000009',
 'WDD2230841A123461', 'Mercedes-Benz', 'S 500 4MATIC', 2022, 28900,
 'petrol', 'automatic', 'AWD', '3.0L Inline-6 EQ Boost',
 'Selenite Grey Magno', 'Macchiato Beige/Magma Grey Nappa', 'Sedan',
 '2022-04-30', 'in_auction',
 'Yousef Al-Hammadi', '+971 50 999 1122', 'yousef.h@example.ae',
 109800, 105000, 124000,
 'Long wheelbase, fully optioned. Executive rear package, Burmester 4D, rear screens, MBUX rear tablet, chauffeur package. Like-new condition.',
 array['LWB','Executive Rear Package','Burmester 4D','MBUX Rear Tablet','Chauffeur Package','Heated Armrests','Massaging Seats','Magic Vision Control']),

-- 10 BMW 740Li M Sport
('11111111-0001-0000-0000-000000000010',
 'WBA7Y4C57PCG12345', 'BMW', '740Li xDrive M Sport', 2023, 14200,
 'petrol', 'automatic', 'AWD', '3.0L Inline-6 TwinPower',
 'Aventurin Red Metallic', 'Mocha/Atlas Grey Merino', 'Sedan',
 '2023-07-15', 'in_auction',
 'Mariam Al-Otaiba', '+971 52 100 2030', 'mariam.o@example.ae',
 119500, 113000, 134000,
 'New generation 7. M Sport Pro, BMW Theatre Screen 31\" 8K rear display, automatic doors, Bowers & Wilkins Diamond. The future of luxury sedans.',
 array['M Sport Pro','BMW Theatre Screen','Automatic Doors','Bowers & Wilkins Diamond','Executive Lounge Seating','Sky Lounge Roof','Crystal Headlights']),

-- 11 Audi A8 L 60 TFSI quattro
('11111111-0001-0000-0000-000000000011',
 'WAUZZZ4N8PN123462', 'Audi', 'A8 L 60 TFSI quattro', 2022, 35100,
 'petrol', 'automatic', 'AWD', '4.0L V8 TFSI',
 'Mythos Black Metallic', 'Cognac Brown Valcona', 'Sedan',
 '2022-06-08', 'in_auction',
 'Tariq Al-Suwaidi', '+971 55 200 3040', 'tariq.s@example.ae',
 89400, 85000, 99000,
 'Full executive specification. Relaxation rear seats with foot massage, B&O Advanced 3D, HD Matrix laser, predictive active suspension.',
 array['Relaxation Rear Seats','Foot Massager','B&O Advanced 3D','HD Matrix Laser','Predictive Active Suspension','Rear Tablets','Air Quality Package']),

-- 12 Porsche Macan GTS
('11111111-0001-0000-0000-000000000012',
 'WP1AG2A53NLB12346', 'Porsche', 'Macan GTS', 2023, 16800,
 'petrol', 'automatic', 'AWD', '2.9L V6 Twin-Turbo',
 'Carmine Red', 'Black/GTS Anthracite Race-Tex', 'SUV',
 '2023-03-22', 'in_auction',
 'Layla Al-Romaithi', '+971 56 300 4050', 'layla.r@example.ae',
 87900, 84000, 98500,
 'GTS specification with Sport Chrono, PASM adaptive air, PSE sport exhaust, GTS interior package. Configured to over AED 480k MSRP.',
 array['GTS Interior Package','Sport Chrono','PASM Air Suspension','PSE Sport Exhaust','Bose Surround','21\" RS Spyder Wheels','Carbon Trim']);

-- =====================================================================
-- Vehicle photos  (Unsplash, 1600px, automotive — curated per make)
-- Hero photo varies by make so each marque has a coherent visual identity.
-- =====================================================================
insert into public.vehicle_photos (vehicle_id, url, category, sort_order, caption) values
-- 1 Mercedes-Benz GLE 450 (Obsidian Black, SUV)
('11111111-0001-0000-0000-000000000001','https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=1600&q=80','exterior',0,'Front three-quarter'),
('11111111-0001-0000-0000-000000000001','https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?w=1600&q=80','exterior',1,'Rear three-quarter'),
('11111111-0001-0000-0000-000000000001','https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=1600&q=80','interior',2,'Cockpit'),
('11111111-0001-0000-0000-000000000001','https://images.unsplash.com/photo-1503736334956-4c8f8e92946d?w=1600&q=80','interior',3,'MBUX dashboard'),
('11111111-0001-0000-0000-000000000001','https://images.unsplash.com/photo-1555215695-3004980ad54e?w=1600&q=80','engine',4,'Inline-6 mild hybrid'),

-- 2 BMW X5 xDrive40i M Sport (Carbon Black)
('11111111-0001-0000-0000-000000000002','https://images.unsplash.com/photo-1556189250-72ba954cfc2b?w=1600&q=80','exterior',0,'Front three-quarter'),
('11111111-0001-0000-0000-000000000002','https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=1600&q=80','exterior',1,'Side profile'),
('11111111-0001-0000-0000-000000000002','https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?w=1600&q=80','exterior',2,'Rear'),
('11111111-0001-0000-0000-000000000002','https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=1600&q=80','interior',3,'M Sport cabin'),
('11111111-0001-0000-0000-000000000002','https://images.unsplash.com/photo-1503736334956-4c8f8e92946d?w=1600&q=80','interior',4,'Live Cockpit Pro'),

-- 3 Porsche Cayenne S (Carrara White, SUV)
('11111111-0001-0000-0000-000000000003','https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=1600&q=80','exterior',0,'Carrara White — front three-quarter'),
('11111111-0001-0000-0000-000000000003','https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?w=1600&q=80','exterior',1,'Rear quarter'),
('11111111-0001-0000-0000-000000000003','https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=1600&q=80','interior',2,'Sport Chrono cockpit'),
('11111111-0001-0000-0000-000000000003','https://images.unsplash.com/photo-1503736334956-4c8f8e92946d?w=1600&q=80','interior',3,'PCM 6.0'),

-- 4 Land Rover Range Rover Sport HSE Dynamic (Santorini Black)
('11111111-0001-0000-0000-000000000004','https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?w=1600&q=80','exterior',0,'Front three-quarter'),
('11111111-0001-0000-0000-000000000004','https://images.unsplash.com/photo-1568844293986-8d0400bd4745?w=1600&q=80','exterior',1,'Side profile'),
('11111111-0001-0000-0000-000000000004','https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=1600&q=80','interior',2,'Windsor leather cabin'),
('11111111-0001-0000-0000-000000000004','https://images.unsplash.com/photo-1503736334956-4c8f8e92946d?w=1600&q=80','interior',3,'Pivi Pro cockpit'),

-- 5 Audi Q8 55 TFSI quattro S line (Glacier White)
('11111111-0001-0000-0000-000000000005','https://images.unsplash.com/photo-1542362567-b07e54358753?w=1600&q=80','exterior',0,'S line front'),
('11111111-0001-0000-0000-000000000005','https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=1600&q=80','exterior',1,'Side profile'),
('11111111-0001-0000-0000-000000000005','https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=1600&q=80','interior',2,'Virtual Cockpit Plus'),
('11111111-0001-0000-0000-000000000005','https://images.unsplash.com/photo-1503736334956-4c8f8e92946d?w=1600&q=80','interior',3,'MMI touch'),

-- 6 Toyota Land Cruiser VXR 300 (Pearl White, SUV)
('11111111-0001-0000-0000-000000000006','https://images.unsplash.com/photo-1568844293986-8d0400bd4745?w=1600&q=80','exterior',0,'VXR — front three-quarter'),
('11111111-0001-0000-0000-000000000006','https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?w=1600&q=80','exterior',1,'Rear quarter'),
('11111111-0001-0000-0000-000000000006','https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=1600&q=80','interior',2,'Tan leather cabin'),
('11111111-0001-0000-0000-000000000006','https://images.unsplash.com/photo-1503736334956-4c8f8e92946d?w=1600&q=80','interior',3,'Multi-Terrain console'),

-- 7 Lexus LX 600 Ultra Luxury (Sonic Quartz)
('11111111-0001-0000-0000-000000000007','https://images.unsplash.com/photo-1568844293986-8d0400bd4745?w=1600&q=80','exterior',0,'Ultra Luxury — front'),
('11111111-0001-0000-0000-000000000007','https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=1600&q=80','exterior',1,'Side profile'),
('11111111-0001-0000-0000-000000000007','https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=1600&q=80','interior',2,'Rear ottoman cabin'),
('11111111-0001-0000-0000-000000000007','https://images.unsplash.com/photo-1503736334956-4c8f8e92946d?w=1600&q=80','interior',3,'Mark Levinson console'),

-- 8 Nissan Patrol Platinum LE (Galaxy Black)
('11111111-0001-0000-0000-000000000008','https://images.unsplash.com/photo-1568844293986-8d0400bd4745?w=1600&q=80','exterior',0,'Platinum LE — front'),
('11111111-0001-0000-0000-000000000008','https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?w=1600&q=80','exterior',1,'Rear'),
('11111111-0001-0000-0000-000000000008','https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=1600&q=80','interior',2,'Quilted leather cabin'),
('11111111-0001-0000-0000-000000000008','https://images.unsplash.com/photo-1503736334956-4c8f8e92946d?w=1600&q=80','interior',3,'BOSE console'),

-- 9 Mercedes-Benz S 500 4MATIC (Selenite Grey, Sedan)
('11111111-0001-0000-0000-000000000009','https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=1600&q=80','exterior',0,'LWB front three-quarter'),
('11111111-0001-0000-0000-000000000009','https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?w=1600&q=80','exterior',1,'Rear quarter'),
('11111111-0001-0000-0000-000000000009','https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=1600&q=80','interior',2,'Executive rear lounge'),
('11111111-0001-0000-0000-000000000009','https://images.unsplash.com/photo-1503736334956-4c8f8e92946d?w=1600&q=80','interior',3,'MBUX hyperscreen'),

-- 10 BMW 740Li xDrive M Sport (Aventurin Red, Sedan)
('11111111-0001-0000-0000-000000000010','https://images.unsplash.com/photo-1556189250-72ba954cfc2b?w=1600&q=80','exterior',0,'Front three-quarter'),
('11111111-0001-0000-0000-000000000010','https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=1600&q=80','exterior',1,'Aventurin Red — side'),
('11111111-0001-0000-0000-000000000010','https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=1600&q=80','interior',2,'Executive Lounge'),
('11111111-0001-0000-0000-000000000010','https://images.unsplash.com/photo-1503736334956-4c8f8e92946d?w=1600&q=80','interior',3,'BMW iDrive 8.5'),

-- 11 Audi A8 L 60 TFSI quattro (Mythos Black, Sedan)
('11111111-0001-0000-0000-000000000011','https://images.unsplash.com/photo-1542362567-b07e54358753?w=1600&q=80','exterior',0,'A8 L — front three-quarter'),
('11111111-0001-0000-0000-000000000011','https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?w=1600&q=80','exterior',1,'Rear quarter'),
('11111111-0001-0000-0000-000000000011','https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=1600&q=80','interior',2,'Valcona rear cabin'),
('11111111-0001-0000-0000-000000000011','https://images.unsplash.com/photo-1503736334956-4c8f8e92946d?w=1600&q=80','interior',3,'Audi Virtual Cockpit'),

-- 12 Porsche Macan GTS (Carmine Red)
('11111111-0001-0000-0000-000000000012','https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=1600&q=80','exterior',0,'Carmine Red — front'),
('11111111-0001-0000-0000-000000000012','https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=1600&q=80','exterior',1,'Side profile'),
('11111111-0001-0000-0000-000000000012','https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=1600&q=80','interior',2,'GTS Race-Tex cockpit'),
('11111111-0001-0000-0000-000000000012','https://images.unsplash.com/photo-1503736334956-4c8f8e92946d?w=1600&q=80','interior',3,'PCM with Sport Chrono');

-- =====================================================================
-- Vehicle damages  (realistic — not every car has them)
-- =====================================================================
insert into public.vehicle_damages (vehicle_id, location, description, severity) values
('11111111-0001-0000-0000-000000000001','Front Bumper, lower right','Scuff mark approx 8cm — paint intact, cosmetic only','cosmetic'),
('11111111-0001-0000-0000-000000000001','Driver Door','Small parking dent, palm-sized — no paint damage','minor'),
('11111111-0001-0000-0000-000000000002','Rear Right Alloy','Kerbing on outer rim, refurbishable','cosmetic'),
('11111111-0001-0000-0000-000000000004','Front Right Fender','Stone chip cluster from highway driving','cosmetic'),
('11111111-0001-0000-0000-000000000004','Rear Bumper','Light scuff from low wall — bumper unmarked underneath','minor'),
('11111111-0001-0000-0000-000000000006','Roof Rails','UV fading from desert sun on plastic trim','cosmetic'),
('11111111-0001-0000-0000-000000000007','Driver Seat Bolster','Light leather wear on outer bolster','cosmetic'),
('11111111-0001-0000-0000-000000000008','Front Bumper','Two stone chips, touched-up','cosmetic'),
('11111111-0001-0000-0000-000000000009','Rear Right Door','Door edge ding from tight parking','minor'),
('11111111-0001-0000-0000-000000000011','Front Left Alloy','Light kerb mark','cosmetic');

-- =====================================================================
-- Auctions — all 12 active, staggered between NOW()+2h and NOW()+96h.
-- Hottest auctions (most bids) end soonest, freshest end last.
-- =====================================================================
insert into public.auctions (
  id, vehicle_id, status, start_time, end_time,
  starting_price_eur, reserve_price_eur, buy_now_price_eur, current_bid_eur
) values
('22222222-0001-0000-0000-000000000003','11111111-0001-0000-0000-000000000003','active', now() - interval '72 hours', now() + interval '2 hours',   90000,  96000, 118000, null), -- Cayenne — 8 bids
('22222222-0001-0000-0000-000000000001','11111111-0001-0000-0000-000000000001','active', now() - interval '48 hours', now() + interval '6 hours',   60000,  65000,  78000, null), -- GLE — 6 bids
('22222222-0001-0000-0000-000000000006','11111111-0001-0000-0000-000000000006','active', now() - interval '24 hours', now() + interval '12 hours',  82000,  88000, 102000, null), -- Land Cruiser — 5 bids
('22222222-0001-0000-0000-000000000002','11111111-0001-0000-0000-000000000002','active', now() - interval '36 hours', now() + interval '18 hours',  70000,  76000,  89000, null), -- X5 — 4 bids
('22222222-0001-0000-0000-000000000010','11111111-0001-0000-0000-000000000010','active', now() - interval '12 hours', now() + interval '24 hours', 105000, 113000, 134000, null), -- 740Li — 4 bids
('22222222-0001-0000-0000-000000000005','11111111-0001-0000-0000-000000000005','active', now() - interval '24 hours', now() + interval '36 hours',  78000,  82000,  96000, null), -- Q8 — 3 bids
('22222222-0001-0000-0000-000000000012','11111111-0001-0000-0000-000000000012','active', now() - interval '18 hours', now() + interval '48 hours',  78000,  84000,  98500, null), -- Macan — 3 bids
('22222222-0001-0000-0000-000000000008','11111111-0001-0000-0000-000000000008','active', now() - interval '8 hours',  now() + interval '60 hours',  68000,  73000,  86000, null), -- Patrol — 2 bids
('22222222-0001-0000-0000-000000000004','11111111-0001-0000-0000-000000000004','active', now() - interval '2 hours',  now() + interval '72 hours',  80000,  84000,  99000, null), -- RR Sport — fresh
('22222222-0001-0000-0000-000000000007','11111111-0001-0000-0000-000000000007','active', now() - interval '1 hour',   now() + interval '84 hours', 110000, 119000, 138000, null), -- LX — fresh
('22222222-0001-0000-0000-000000000009','11111111-0001-0000-0000-000000000009','active', now() - interval '1 hour',   now() + interval '90 hours', 100000, 105000, 124000, null), -- S 500 — fresh
('22222222-0001-0000-0000-000000000011','11111111-0001-0000-0000-000000000011','active', now() - interval '1 hour',   now() + interval '96 hours',  82000,  85000,  99000, null); -- A8 — fresh

-- =====================================================================
-- Bid history  (only against auctions for which we know a bidder uid)
-- =====================================================================
do $$
declare
  v_buyer  uuid;
  v_buyer2 uuid;
  v_buyer3 uuid;
begin
  select id into v_buyer  from auth.users where email = 'buyer@xportacar.com';
  select id into v_buyer2 from auth.users where email = 'buyer2@xportacar.com';
  select id into v_buyer3 from auth.users where email = 'buyer3@xportacar.com';

  -- Fall back to a single buyer if the others aren't seeded
  v_buyer2 := coalesce(v_buyer2, v_buyer);
  v_buyer3 := coalesce(v_buyer3, v_buyer);

  if v_buyer is null then
    raise notice 'Skipping bid seed — buyer@xportacar.com not present in auth.users.';
    return;
  end if;

  -- GLE 450  (auction 1)  6 bids, climbing toward reserve
  insert into public.bids (auction_id, bidder_id, amount_eur, created_at) values
    ('22222222-0001-0000-0000-000000000001', v_buyer,  60500, now() - interval '46 hours'),
    ('22222222-0001-0000-0000-000000000001', v_buyer2, 61500, now() - interval '40 hours'),
    ('22222222-0001-0000-0000-000000000001', v_buyer3, 62500, now() - interval '30 hours'),
    ('22222222-0001-0000-0000-000000000001', v_buyer,  63500, now() - interval '20 hours'),
    ('22222222-0001-0000-0000-000000000001', v_buyer2, 64500, now() - interval '8 hours'),
    ('22222222-0001-0000-0000-000000000001', v_buyer3, 66000, now() - interval '90 minutes');

  -- X5  (auction 2)  4 bids
  insert into public.bids (auction_id, bidder_id, amount_eur, created_at) values
    ('22222222-0001-0000-0000-000000000002', v_buyer3, 71000, now() - interval '22 hours'),
    ('22222222-0001-0000-0000-000000000002', v_buyer,  72500, now() - interval '14 hours'),
    ('22222222-0001-0000-0000-000000000002', v_buyer2, 74000, now() - interval '6 hours'),
    ('22222222-0001-0000-0000-000000000002', v_buyer3, 75500, now() - interval '50 minutes');

  -- Cayenne  (auction 3)  hot — 8 bids
  insert into public.bids (auction_id, bidder_id, amount_eur, created_at) values
    ('22222222-0001-0000-0000-000000000003', v_buyer,  91000, now() - interval '70 hours'),
    ('22222222-0001-0000-0000-000000000003', v_buyer2, 93000, now() - interval '60 hours'),
    ('22222222-0001-0000-0000-000000000003', v_buyer3, 95000, now() - interval '50 hours'),
    ('22222222-0001-0000-0000-000000000003', v_buyer,  96500, now() - interval '36 hours'),
    ('22222222-0001-0000-0000-000000000003', v_buyer2, 98000, now() - interval '24 hours'),
    ('22222222-0001-0000-0000-000000000003', v_buyer3, 99500, now() - interval '12 hours'),
    ('22222222-0001-0000-0000-000000000003', v_buyer, 101500, now() - interval '4 hours'),
    ('22222222-0001-0000-0000-000000000003', v_buyer2, 103500, now() - interval '25 minutes');

  -- Q8  (auction 5)  3 bids
  insert into public.bids (auction_id, bidder_id, amount_eur, created_at) values
    ('22222222-0001-0000-0000-000000000005', v_buyer2, 79000, now() - interval '10 hours'),
    ('22222222-0001-0000-0000-000000000005', v_buyer,  80500, now() - interval '6 hours'),
    ('22222222-0001-0000-0000-000000000005', v_buyer3, 82000, now() - interval '2 hours');

  -- Land Cruiser  (auction 6)  5 bids
  insert into public.bids (auction_id, bidder_id, amount_eur, created_at) values
    ('22222222-0001-0000-0000-000000000006', v_buyer,  83000, now() - interval '18 hours'),
    ('22222222-0001-0000-0000-000000000006', v_buyer3, 85000, now() - interval '14 hours'),
    ('22222222-0001-0000-0000-000000000006', v_buyer2, 87000, now() - interval '8 hours'),
    ('22222222-0001-0000-0000-000000000006', v_buyer,  88500, now() - interval '4 hours'),
    ('22222222-0001-0000-0000-000000000006', v_buyer3, 90000, now() - interval '40 minutes');

  -- Patrol  (auction 8)  2 bids
  insert into public.bids (auction_id, bidder_id, amount_eur, created_at) values
    ('22222222-0001-0000-0000-000000000008', v_buyer2, 69000, now() - interval '6 hours'),
    ('22222222-0001-0000-0000-000000000008', v_buyer,  71500, now() - interval '2 hours');

  -- 740Li  (auction 10)  4 bids
  insert into public.bids (auction_id, bidder_id, amount_eur, created_at) values
    ('22222222-0001-0000-0000-000000000010', v_buyer3, 106500, now() - interval '5 hours'),
    ('22222222-0001-0000-0000-000000000010', v_buyer2, 109000, now() - interval '3 hours'),
    ('22222222-0001-0000-0000-000000000010', v_buyer,  111500, now() - interval '90 minutes'),
    ('22222222-0001-0000-0000-000000000010', v_buyer3, 114000, now() - interval '20 minutes');

  -- Macan GTS  (auction 12)  3 bids
  insert into public.bids (auction_id, bidder_id, amount_eur, created_at) values
    ('22222222-0001-0000-0000-000000000012', v_buyer,  79500, now() - interval '14 hours'),
    ('22222222-0001-0000-0000-000000000012', v_buyer2, 82000, now() - interval '6 hours'),
    ('22222222-0001-0000-0000-000000000012', v_buyer3, 85000, now() - interval '50 minutes');
end $$;

-- A few watchlist items for the demo buyer
insert into public.watchlist (user_id, vehicle_id)
select id, vid from auth.users
cross join (values
  ('11111111-0001-0000-0000-000000000003'::uuid),
  ('11111111-0001-0000-0000-000000000005'::uuid),
  ('11111111-0001-0000-0000-000000000010'::uuid)
) as v(vid)
where email = 'buyer@xportacar.com'
on conflict do nothing;

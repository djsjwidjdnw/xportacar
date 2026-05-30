-- One-off, re-runnable demo INSPECTION ASSIGNMENT for the inspector app.
-- Adds a single Mercedes-Benz G63 AMG assigned to the demo inspector with
-- NO photos, damages or inspection data — so the inspector app shows a
-- fresh "ready to inspect" assignment that demos the wizard from step 1.
--
-- Idempotent: deletes any prior demo G63 (by fixed id or VIN) first.
-- Uses the demo prefix 11111111-0002-... so cleanup_demo_data.sql sweeps it.
--
-- Note on status: the vehicle_status enum has 'inspection_scheduled' (not
-- 'pending_inspection') — that's the value used here as the semantic match
-- for "assigned, waiting to be inspected".
begin;

-- ---- Clean up any prior demo G63 (idempotent) -----------------------
delete from public.vehicle_photos
  where vehicle_id = '11111111-0002-0000-0000-000000000998'
     or vehicle_id in (select id from public.vehicles where vin = 'WDC4632F6PX998877');
delete from public.vehicle_damages
  where vehicle_id = '11111111-0002-0000-0000-000000000998'
     or vehicle_id in (select id from public.vehicles where vin = 'WDC4632F6PX998877');
delete from public.vehicles
  where id = '11111111-0002-0000-0000-000000000998'
     or vin = 'WDC4632F6PX998877';

-- ---- Surface a warning if the demo inspector isn't in profiles ------
do $$
begin
  if not exists (select 1 from public.profiles where email = 'inspector@xportacar.com') then
    raise warning 'inspector@xportacar.com not found in profiles — the assignment will be inserted with inspector_id = NULL.';
  end if;
end $$;

-- ---- Insert the fresh assignment (no photos, no damages) ------------
insert into public.vehicles (
  id, vin, make, model, year, mileage_km, fuel_type, transmission,
  drivetrain, engine, exterior_color, interior_color, body_type,
  first_registration, location_city, location_country, status,
  seller_name, seller_phone, seller_email,
  inspector_id, description
) values (
  '11111111-0002-0000-0000-000000000998',
  'WDC4632F6PX998877', 'Mercedes-Benz', 'G63 AMG', 2023, 18000,
  'petrol', 'automatic', '4WD', '4.0L V8 Biturbo',
  'Obsidian Black', 'Black Nappa Leather', 'SUV',
  '2023-04-15', 'Dubai', 'UAE',
  'inspection_scheduled',
  'Demo Seller', '+971 50 000 0001', 'demo.seller.g63@example.ae',
  (select id from public.profiles where email = 'inspector@xportacar.com'),
  'Demo inspection assignment for App Store screenshots.'
);

commit;

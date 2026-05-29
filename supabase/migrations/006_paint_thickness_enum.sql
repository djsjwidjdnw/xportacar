-- Adds the 'paint_thickness' photo category used by the inspection app's
-- Paint Thickness Test capture. Kept in its own migration so the new enum
-- value is committed before anything inserts rows that use it.
alter type public.photo_category add value if not exists 'paint_thickness';

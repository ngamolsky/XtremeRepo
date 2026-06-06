-- Summarize photo albums by race year/name so race detail pages can link to albums.

CREATE INDEX IF NOT EXISTS race_photos_year_race_sort_order_idx
  ON public.race_photos (year DESC, race, sort_order, created_at, storage_path);

CREATE OR REPLACE VIEW public.v_race_photo_album_summary
WITH (security_invoker = true) AS
SELECT
  race_photos.year,
  race_photos.race,
  min(race_photos.event_name) AS event_name,
  count(*)::integer AS photo_count,
  (array_agg(
    race_photos.storage_bucket
    ORDER BY race_photos.featured DESC, race_photos.sort_order, race_photos.created_at, race_photos.storage_path
  ))[1] AS cover_storage_bucket,
  (array_agg(
    race_photos.storage_path
    ORDER BY race_photos.featured DESC, race_photos.sort_order, race_photos.created_at, race_photos.storage_path
  ))[1] AS cover_storage_path,
  min(race_photos.created_at) AS first_photo_created_at,
  max(race_photos.created_at) AS last_photo_created_at
FROM public.race_photos
GROUP BY race_photos.year, race_photos.race;

COMMENT ON VIEW public.v_race_photo_album_summary IS
  'Photo album rollups linked to race detail pages by race_photos.year and race_photos.race.';

GRANT SELECT ON public.v_race_photo_album_summary TO authenticated;
GRANT SELECT ON public.v_race_photo_album_summary TO service_role;

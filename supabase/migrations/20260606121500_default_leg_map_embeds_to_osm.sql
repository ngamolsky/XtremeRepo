-- Use MapMyFitness' OpenStreet tile key for embedded route maps.

UPDATE public.leg_definitions
SET map_embed_url = replace(
  replace(map_embed_url, 'map_mode=OPENSTREET', 'map_mode=osm'),
  'map_mode=ROADMAP',
  'map_mode=osm'
)
WHERE map_embed_url LIKE '%map_mode=OPENSTREET%'
   OR map_embed_url LIKE '%map_mode=ROADMAP%';

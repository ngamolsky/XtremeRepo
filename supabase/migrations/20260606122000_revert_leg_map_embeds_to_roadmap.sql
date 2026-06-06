-- Keep MapMyFitness embeds on their original roadmap mode.

UPDATE public.leg_definitions
SET map_embed_url = replace(
  replace(map_embed_url, 'map_mode=OPENSTREET', 'map_mode=ROADMAP'),
  'map_mode=osm',
  'map_mode=ROADMAP'
)
WHERE map_embed_url LIKE '%map_mode=OPENSTREET%'
   OR map_embed_url LIKE '%map_mode=osm%';

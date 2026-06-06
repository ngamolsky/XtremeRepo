-- Prefer OpenStreet tiles for MapMyFitness embeds; ROADMAP can render blank base tiles in iframes.

UPDATE public.leg_definitions
SET map_embed_url = replace(map_embed_url, 'map_mode=ROADMAP', 'map_mode=OPENSTREET')
WHERE map_embed_url LIKE '%map_mode=ROADMAP%';

-- Revert MapMyFitness embeds to their original roadmap mode.

UPDATE public.leg_definitions
SET map_embed_url = replace(map_embed_url, 'map_mode=OPENSTREET', 'map_mode=ROADMAP')
WHERE map_embed_url LIKE '%map_mode=OPENSTREET%';

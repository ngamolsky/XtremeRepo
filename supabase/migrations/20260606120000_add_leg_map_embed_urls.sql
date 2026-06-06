-- Store optional official route map embeds for v2 leg definitions.

ALTER TABLE public.leg_definitions
  ADD COLUMN IF NOT EXISTS map_embed_url text;

COMMENT ON COLUMN public.leg_definitions.map_embed_url IS
  'Optional embeddable route map URL for this leg definition.';

UPDATE public.leg_definitions
SET map_embed_url = CASE number
  WHEN 1 THEN 'https://snippets.mapmycdn.com/routes/view/embedded/1451785543?width=600&height=600&elevation=true&info=true&line_color=E60f0bdb&rgbhex=DB0B0E&distance_markers=1&unit_type=imperial&map_mode=ROADMAP&last_updated=2017-04-11T20:36:04-07:00'
  WHEN 2 THEN 'https://snippets.mapmycdn.com/routes/view/embedded/1435280143?width=600&height=600&elevation=true&info=true&line_color=E60f0bdb&rgbhex=DB0B0E&distance_markers=0&unit_type=imperial&map_mode=ROADMAP&last_updated=2017-04-11T21:02:08-07:00'
  WHEN 3 THEN 'https://snippets.mapmycdn.com/routes/view/embedded/1435329766?width=600&height=500&elevation=true&info=true&line_color=E60f0bdb&rgbhex=DB0B0E&distance_markers=0&unit_type=imperial&map_mode=ROADMAP&last_updated=2017-04-11T21:07:24-07:00'
  WHEN 4 THEN 'https://snippets.mapmycdn.com/routes/view/embedded/1435378663?width=600&height=400&elevation=true&info=true&line_color=E60f0bdb&rgbhex=DB0B0E&distance_markers=1&unit_type=imperial&map_mode=ROADMAP&last_updated=2017-04-12T18:12:09-07:00'
  WHEN 5 THEN 'https://snippets.mapmycdn.com/routes/view/embedded/1435415431?width=600&height=500&elevation=true&info=true&line_color=E60f0bdb&rgbhex=DB0B0E&distance_markers=1&unit_type=imperial&map_mode=ROADMAP&last_updated=2017-04-12T18:14:57-07:00'
  WHEN 6 THEN 'https://snippets.mapmycdn.com/routes/view/embedded/1435421707?width=600&height=400&elevation=true&info=true&line_color=E60f0bdb&rgbhex=DB0B0E&distance_markers=1&unit_type=imperial&map_mode=ROADMAP&last_updated=2017-04-12T18:17:18-07:00'
  WHEN 7 THEN 'https://snippets.mapmycdn.com/routes/view/embedded/1056520991?width=600&height=400&elevation=true&info=true&line_color=E60f0bdb&rgbhex=DB0B0E&distance_markers=1&unit_type=imperial&map_mode=ROADMAP&last_updated=2017-04-12T18:21:01-07:00'
END
WHERE version = 2
  AND number BETWEEN 1 AND 7;

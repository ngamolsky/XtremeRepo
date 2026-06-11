ALTER TABLE public.leg_result_observations
  DROP CONSTRAINT IF EXISTS leg_result_observations_source_type_check;

UPDATE public.leg_result_observations
SET
  source_label = CASE
    WHEN source_type IN ('apple_watch', 'garmin') THEN NULL
    WHEN source_type = 'strava' THEN COALESCE(NULLIF(source_label, ''), 'Unknown recording device')
    WHEN source_type = 'phone' THEN COALESCE(NULLIF(source_label, ''), 'Phone')
    WHEN source_type = 'manual_runner' THEN COALESCE(NULLIF(source_label, ''), 'Runner-entered manual data')
    WHEN source_type = 'manual_admin' THEN COALESCE(NULLIF(source_label, ''), 'Admin-entered manual data')
    WHEN source_type = 'other' THEN source_label
    ELSE COALESCE(NULLIF(source_label, ''), source_type)
  END,
  raw_metadata = CASE
    WHEN source_type = 'strava' THEN
      jsonb_set(
        COALESCE(raw_metadata, '{}'::jsonb),
        '{screenshot,suggestedAppName}',
        '"Strava"'::jsonb,
        true
      )
    ELSE COALESCE(raw_metadata, '{}'::jsonb)
  END,
  source_type = CASE
    WHEN source_type IN ('apple_watch', 'garmin') THEN source_type
    ELSE 'other'
  END;

ALTER TABLE public.leg_result_observations
  ALTER COLUMN source_type SET DEFAULT 'other';

ALTER TABLE public.leg_result_observations
  ADD CONSTRAINT leg_result_observations_source_type_check
  CHECK (source_type = ANY (ARRAY['apple_watch'::text, 'garmin'::text, 'other'::text]));

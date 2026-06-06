-- Some legacy observation notes were generated as source provenance. Keep that
-- evidence as source metadata instead of a human-authored comment.

WITH legacy_notes AS (
  SELECT id, year, leg_number, leg_version, runner_id, body
  FROM public.comments
  WHERE target_type = 'leg_instance'
    AND body LIKE 'Provisional non-canonical observation from Strava screenshot.%'
)
UPDATE public.leg_result_observations observation
SET raw_metadata = observation.raw_metadata || jsonb_build_object('legacy_note', legacy_notes.body)
FROM legacy_notes
WHERE observation.year = legacy_notes.year
  AND observation.leg_number = legacy_notes.leg_number
  AND observation.leg_version = legacy_notes.leg_version
  AND observation.runner_id = legacy_notes.runner_id
  AND observation.source_type = 'strava'
  AND observation.source_label = 'Strava screenshot';

DELETE FROM public.comments
WHERE target_type = 'leg_instance'
  AND body LIKE 'Provisional non-canonical observation from Strava screenshot.%';

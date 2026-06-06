-- Notes that were previously stored as note-only provisional observations are
-- now comments. Remove the empty wrapper rows so provisional evidence only
-- contains actual observed data or source metadata.

DELETE FROM public.leg_result_observations
WHERE source_type = 'manual_runner'
  AND source_label = 'Run detail note'
  AND raw_metadata->>'origin' = 'run_instance_detail'
  AND lap_time IS NULL
  AND moving_time IS NULL
  AND elapsed_time IS NULL
  AND distance IS NULL
  AND elevation_gain IS NULL;

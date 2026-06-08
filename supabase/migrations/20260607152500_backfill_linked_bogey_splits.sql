-- Populate canonical Xtreme leg splits for linked historical team rows that were linked
-- by total-time match in the previous bogey source-data migration.
INSERT INTO public.historical_leg_splits (
  team_result_id,
  leg_number,
  split_time_text,
  split_time_seconds,
  runner_name,
  metadata
)
SELECT
  link.historical_team_result_id,
  canonical.leg_number,
  canonical.lap_time::text,
  round(canonical.time_in_minutes * 60)::integer,
  canonical.runner_name,
  jsonb_build_object(
    'backfilled_from', 'canonical_official_results',
    'reason', 'bogey source-data readiness',
    'source_type', canonical.source_type
  )
FROM public.our_team_result_links AS link
JOIN public.v_results_with_pace AS canonical
  ON canonical.year = link.year
WHERE canonical.source_type = 'official'
ON CONFLICT (team_result_id, leg_number) DO NOTHING;

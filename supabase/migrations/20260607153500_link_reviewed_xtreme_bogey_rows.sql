-- Link reviewed Xtreme/Falcons historical rows that were missed by strict total-time
-- matching, then populate their canonical official splits for bogey comparisons.
WITH canonical_totals AS (
  SELECT
    year,
    count(*) AS leg_count,
    round(sum(time_in_minutes) * 60)::integer AS total_seconds
  FROM public.v_results_with_pace
  WHERE source_type = 'official'
  GROUP BY year
), candidate_links AS (
  SELECT
    canonical.year,
    result.id AS historical_team_result_id,
    row_number() OVER (
      PARTITION BY canonical.year
      ORDER BY
        abs(result.total_time_seconds - canonical.total_seconds) NULLS LAST,
        result.overall_place NULLS LAST,
        result.id
    ) AS candidate_rank
  FROM canonical_totals AS canonical
  JOIN public.historical_team_results AS result
    ON result.year = canonical.year
   AND result.is_our_team = true
  WHERE canonical.leg_count = 7
), inserted_links AS (
  INSERT INTO public.our_team_result_links (
    year,
    historical_team_result_id,
    canonical_team_name,
    linked_by,
    notes
  )
  SELECT
    year,
    historical_team_result_id,
    'Xtreme Falcons',
    'agent_reviewed',
    'Auto-linked from reviewed is_our_team historical result for bogey source-data backfill.'
  FROM candidate_links
  WHERE candidate_rank = 1
  ON CONFLICT (year) DO NOTHING
  RETURNING year, historical_team_result_id
), split_link_source AS (
  SELECT year, historical_team_result_id
  FROM public.our_team_result_links
  UNION
  SELECT year, historical_team_result_id
  FROM inserted_links
)
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
    'reason', 'bogey source-data readiness from reviewed Xtreme team link',
    'source_type', canonical.source_type
  )
FROM split_link_source AS link
JOIN public.v_results_with_pace AS canonical
  ON canonical.year = link.year
WHERE canonical.source_type = 'official'
ON CONFLICT (team_result_id, leg_number) DO NOTHING;

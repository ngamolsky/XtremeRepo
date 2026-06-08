-- Treat parsed spreadsheet/PDF historical result rows as the canonical source for
-- bogey calculations where per-leg split values are present. 2022 is a partial-
-- split spreadsheet year: many official rows have Lap 1-5 only and dashes for
-- later laps, so bogeys should be computed for the legs that have official source
-- split values instead of requiring a complete seven-leg team row.
WITH source_tokens AS (
  SELECT
    id AS team_result_id,
    leg_number,
    split_time_text
  FROM public.historical_team_results AS result
  CROSS JOIN LATERAL (
    VALUES
      (1, trim(split_part(result.raw_text, '|', 6))),
      (2, trim(split_part(result.raw_text, '|', 7))),
      (3, trim(split_part(result.raw_text, '|', 8))),
      (4, trim(split_part(result.raw_text, '|', 9))),
      (5, trim(split_part(result.raw_text, '|', 10))),
      (6, trim(split_part(result.raw_text, '|', 11))),
      (7, trim(split_part(result.raw_text, '|', 12)))
  ) AS split_values(leg_number, split_time_text)
  WHERE result.year = 2022
    AND split_values.split_time_text ~ '^[0-9]+:[0-9]{2}(?::[0-9]{2})?(\.[0-9]+)?$'
), parsed_splits AS (
  SELECT
    team_result_id,
    leg_number,
    split_time_text,
    CASE
      WHEN split_time_text ~ '^[0-9]+:[0-9]{2}:[0-9]{2}(\.[0-9]+)?$' THEN
        split_part(split_time_text, ':', 1)::integer * 3600
        + split_part(split_time_text, ':', 2)::integer * 60
        + floor(split_part(split_time_text, ':', 3)::numeric)::integer
      ELSE
        split_part(split_time_text, ':', 1)::integer * 60
        + floor(split_part(split_time_text, ':', 2)::numeric)::integer
    END AS split_time_seconds
  FROM source_tokens
)
INSERT INTO public.historical_leg_splits (
  team_result_id,
  leg_number,
  split_time_text,
  split_time_seconds,
  metadata
)
SELECT
  team_result_id,
  leg_number,
  split_time_text,
  split_time_seconds,
  jsonb_build_object(
    'backfilled_from', 'historical_source_raw_text',
    'reason', '2022 official spreadsheet partial split support for bogeys'
  )
FROM parsed_splits
WHERE split_time_seconds > 0
ON CONFLICT (team_result_id, leg_number) DO NOTHING;

CREATE OR REPLACE VIEW public.v_bogey_events AS
WITH split_quality AS (
  SELECT
    team_result_id,
    count(*) FILTER (WHERE split_time_seconds IS NOT NULL AND split_time_seconds > 0) AS positive_split_count,
    COALESCE(sum(split_time_seconds) FILTER (WHERE split_time_seconds IS NOT NULL AND split_time_seconds > 0), 0) AS positive_split_seconds
  FROM public.historical_leg_splits
  GROUP BY team_result_id
), representative_team_results AS (
  SELECT DISTINCT ON (
    team.year,
    COALESCE(team.bib, ''),
    COALESCE(team.team_name_raw, ''),
    COALESCE(team.total_time_seconds, -1)
  )
    team.id,
    team.year,
    team.team_name_raw,
    team.bib,
    team.division,
    team.start_offset_seconds
  FROM public.historical_team_results AS team
  JOIN split_quality AS quality
    ON quality.team_result_id = team.id
   AND quality.positive_split_count > 0
   AND quality.positive_split_seconds > 0
  LEFT JOIN public.our_team_result_links AS link
    ON link.historical_team_result_id = team.id
  ORDER BY
    team.year,
    COALESCE(team.bib, ''),
    COALESCE(team.team_name_raw, ''),
    COALESCE(team.total_time_seconds, -1),
    (link.historical_team_result_id IS NOT NULL) DESC,
    quality.positive_split_count DESC,
    team.overall_place NULLS LAST,
    team.id
), split_positions AS (
  SELECT
    team.id AS team_result_id,
    team.year,
    team.team_name_raw AS team_name,
    team.bib,
    team.division,
    team.start_offset_seconds,
    split.leg_number,
    COALESCE(
      SUM(split.split_time_seconds) OVER (
        PARTITION BY team.id
        ORDER BY split.leg_number
        ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
      ),
      0
    )::integer AS elapsed_before_seconds,
    SUM(split.split_time_seconds) OVER (
      PARTITION BY team.id
      ORDER BY split.leg_number
      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    )::integer AS elapsed_after_seconds
  FROM representative_team_results AS team
  JOIN public.historical_leg_splits AS split
    ON split.team_result_id = team.id
  WHERE split.split_time_seconds IS NOT NULL
    AND split.split_time_seconds > 0
), our_positions AS (
  SELECT
    link.year,
    link.historical_team_result_id AS our_team_result_id,
    position.leg_number,
    position.start_offset_seconds AS our_start_offset_seconds,
    position.elapsed_before_seconds,
    position.elapsed_after_seconds
  FROM public.our_team_result_links AS link
  JOIN split_positions AS position
    ON position.team_result_id = link.historical_team_result_id
   AND position.year = link.year
), crossings AS (
  SELECT
    our.year,
    our.our_team_result_id,
    our.leg_number,
    canonical.leg_version,
    canonical.runner_id,
    canonical.runner_name,
    other.team_result_id AS other_team_result_id,
    other.team_name AS other_team_name,
    other.bib AS other_bib,
    other.division AS other_division,
    our.our_start_offset_seconds,
    other.start_offset_seconds AS other_start_offset_seconds,
    our.elapsed_before_seconds AS our_elapsed_before_seconds,
    our.elapsed_after_seconds AS our_elapsed_after_seconds,
    other.elapsed_before_seconds AS other_elapsed_before_seconds,
    other.elapsed_after_seconds AS other_elapsed_after_seconds,
    (our.our_start_offset_seconds IS NOT NULL AND other.start_offset_seconds IS NOT NULL) AS start_offsets_known,
    CASE
      WHEN our.our_start_offset_seconds IS NOT NULL AND other.start_offset_seconds IS NOT NULL
        THEN 'known_start_offsets'::text
      ELSE 'same_start_assumed'::text
    END AS time_basis,
    (COALESCE(our.our_start_offset_seconds, 0) + our.elapsed_before_seconds) AS our_before_position_seconds,
    (COALESCE(our.our_start_offset_seconds, 0) + our.elapsed_after_seconds) AS our_after_position_seconds,
    (COALESCE(other.start_offset_seconds, 0) + other.elapsed_before_seconds) AS other_before_position_seconds,
    (COALESCE(other.start_offset_seconds, 0) + other.elapsed_after_seconds) AS other_after_position_seconds
  FROM our_positions AS our
  JOIN split_positions AS other
    ON other.year = our.year
   AND other.leg_number = our.leg_number
   AND other.team_result_id <> our.our_team_result_id
  JOIN public.v_results_with_pace AS canonical
    ON canonical.year = our.year
   AND canonical.leg_number = our.leg_number
   AND canonical.source_type = 'official'
), event_rows AS (
  SELECT
    md5(concat_ws(':', year::text, leg_number::text, COALESCE(leg_version::text, 'unknown'), COALESCE(runner_id::text, runner_name, 'unknown-runner'), other_team_result_id::text, 'passed_by_us')) AS event_id,
    year,
    runner_id,
    runner_name,
    leg_number,
    leg_version,
    'passed_by_us'::text AS event_type,
    other_team_result_id,
    other_team_name,
    other_bib,
    other_division,
    ABS((our_after_position_seconds - other_after_position_seconds) - (our_before_position_seconds - other_before_position_seconds))::integer AS seconds_swung,
    our_elapsed_before_seconds,
    our_elapsed_after_seconds,
    other_elapsed_before_seconds,
    other_elapsed_after_seconds,
    our_start_offset_seconds,
    other_start_offset_seconds,
    start_offsets_known,
    time_basis
  FROM crossings
  WHERE our_before_position_seconds >= other_before_position_seconds
    AND our_after_position_seconds < other_after_position_seconds

  UNION ALL

  SELECT
    md5(concat_ws(':', year::text, leg_number::text, COALESCE(leg_version::text, 'unknown'), COALESCE(runner_id::text, runner_name, 'unknown-runner'), other_team_result_id::text, 'passed_us')) AS event_id,
    year,
    runner_id,
    runner_name,
    leg_number,
    leg_version,
    'passed_us'::text AS event_type,
    other_team_result_id,
    other_team_name,
    other_bib,
    other_division,
    ABS((our_after_position_seconds - other_after_position_seconds) - (our_before_position_seconds - other_before_position_seconds))::integer AS seconds_swung,
    our_elapsed_before_seconds,
    our_elapsed_after_seconds,
    other_elapsed_before_seconds,
    other_elapsed_after_seconds,
    our_start_offset_seconds,
    other_start_offset_seconds,
    start_offsets_known,
    time_basis
  FROM crossings
  WHERE our_before_position_seconds <= other_before_position_seconds
    AND our_after_position_seconds > other_after_position_seconds
)
SELECT *
FROM event_rows;

GRANT SELECT ON TABLE public.v_bogey_events TO authenticated;
GRANT SELECT ON TABLE public.v_bogey_events TO service_role;

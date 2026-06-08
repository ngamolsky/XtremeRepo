-- Add optional start offsets and computed bogey/pass events.
-- A bogey here means our runner's leg crossed another team's official source split
-- position during that leg. Division is intentionally ignored.
-- Physical position formula when offsets are known: start_offset_seconds + elapsed_before_seconds.

ALTER TABLE public.historical_team_results
  ADD COLUMN IF NOT EXISTS start_offset_seconds integer;

ALTER TABLE public.historical_team_results
  DROP CONSTRAINT IF EXISTS historical_team_results_start_offset_seconds_check;
ALTER TABLE public.historical_team_results
  ADD CONSTRAINT historical_team_results_start_offset_seconds_check
  CHECK (start_offset_seconds IS NULL OR start_offset_seconds BETWEEN 0 AND 86400);

CREATE INDEX IF NOT EXISTS historical_team_results_start_offset_idx
  ON public.historical_team_results (year, start_offset_seconds);

CREATE OR REPLACE VIEW public.v_bogey_events AS
WITH split_positions AS (
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
  FROM public.historical_team_results AS team
  JOIN public.historical_leg_splits AS split
    ON split.team_result_id = team.id
  WHERE split.split_time_seconds IS NOT NULL
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
), event_rows AS (
  SELECT
    md5(
      concat_ws(
        ':',
        year::text,
        leg_number::text,
        COALESCE(leg_version::text, 'unknown'),
        COALESCE(runner_id::text, runner_name, 'unknown-runner'),
        other_team_result_id::text,
        'passed_by_us'
      )
    ) AS event_id,
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
  WHERE our_before_position_seconds > other_before_position_seconds
    AND our_after_position_seconds < other_after_position_seconds

  UNION ALL

  SELECT
    md5(
      concat_ws(
        ':',
        year::text,
        leg_number::text,
        COALESCE(leg_version::text, 'unknown'),
        COALESCE(runner_id::text, runner_name, 'unknown-runner'),
        other_team_result_id::text,
        'passed_us'
      )
    ) AS event_id,
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
  WHERE our_before_position_seconds < other_before_position_seconds
    AND our_after_position_seconds > other_after_position_seconds
)
SELECT *
FROM event_rows;

GRANT SELECT ON TABLE public.v_bogey_events TO authenticated;
GRANT SELECT ON TABLE public.v_bogey_events TO service_role;

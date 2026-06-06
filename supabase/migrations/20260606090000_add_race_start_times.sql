-- Store race start times on each race year and expose leg time-of-day helpers.

ALTER TABLE public.placements
  ADD COLUMN IF NOT EXISTS race_start_time time without time zone DEFAULT '07:00:00'::time NOT NULL;

UPDATE public.placements
SET race_start_time = '07:00:00'::time
WHERE race_start_time IS NULL;

UPDATE public.placements
SET race_start_time = '06:00:00'::time
WHERE year = 2024;

ALTER TABLE public.placements
  ALTER COLUMN race_start_time SET DEFAULT '07:00:00'::time,
  ALTER COLUMN race_start_time SET NOT NULL;

CREATE OR REPLACE VIEW public.team_performance_summary AS
 WITH yearly_totals AS (
         SELECT r.year,
            sum(EXTRACT(epoch FROM r.lap_time)) AS total_seconds,
            sum(ld.distance) AS total_distance
           FROM public.results r
             JOIN public.leg_definitions ld ON r.leg_number = ld.number AND r.leg_version = ld.version
          GROUP BY r.year
        ), yearly_stats AS (
         SELECT yt.year,
            yt.total_seconds,
            make_interval(secs => yt.total_seconds::double precision) AS total_time,
                CASE
                    WHEN yt.total_distance > 0::double precision THEN yt.total_seconds::double precision / yt.total_distance
                    ELSE NULL::double precision
                END AS average_pace,
            p.division_place,
            p.division_teams,
            p.overall_place,
            p.overall_teams,
            p.race_start_time
           FROM yearly_totals yt
             JOIN public.placements p ON yt.year = p.year
        )
 SELECT year,
    total_time,
        CASE
            WHEN average_pace IS NOT NULL THEN make_interval(secs => round(average_pace))
            ELSE NULL::interval
        END AS average_pace,
    division_place,
    division_teams,
    overall_place,
    overall_teams,
    lag(overall_place) OVER (ORDER BY year) - overall_place AS improvement,
    race_start_time
   FROM yearly_stats
  ORDER BY year;

CREATE OR REPLACE VIEW public.v_results_with_pace AS
 WITH ordered_results AS (
         SELECT r.year,
            r.user_id AS runner_id,
            r.leg_number,
            r.leg_version,
            r.lap_time,
            ld.distance,
            ld.elevation_gain,
            rn.name AS runner_name,
            rn.auth_user_id,
            public.parse_time_to_minutes(r.lap_time) AS time_in_minutes,
                CASE
                    WHEN ld.distance > 0::double precision THEN public.parse_time_to_minutes(r.lap_time) / ld.distance
                    ELSE NULL::double precision
                END AS pace,
            r.notes,
            r.source_type,
            r.canonical_observation_id,
            p.race_start_time,
            COALESCE(
              sum(COALESCE(r.lap_time, '00:00:00'::interval)) OVER (
                PARTITION BY r.year
                ORDER BY r.leg_number
                ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
              ),
              '00:00:00'::interval
            ) AS elapsed_before_leg,
            COALESCE(
              sum(COALESCE(r.lap_time, '00:00:00'::interval)) OVER (
                PARTITION BY r.year
                ORDER BY r.leg_number
                ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
              ),
              '00:00:00'::interval
            ) AS elapsed_through_leg
           FROM public.results r
             JOIN public.leg_definitions ld ON r.leg_number = ld.number AND r.leg_version = ld.version
             JOIN public.placements p ON r.year = p.year
             LEFT JOIN public.runners rn ON r.user_id = rn.id
        )
 SELECT year,
    runner_id,
    leg_number,
    leg_version,
    lap_time,
    distance,
    elevation_gain,
    runner_name,
    auth_user_id,
    time_in_minutes,
    pace,
    notes,
    source_type,
    canonical_observation_id,
    race_start_time,
    race_start_time + elapsed_before_leg AS leg_start_time,
    race_start_time + elapsed_through_leg AS leg_finish_time
   FROM ordered_results;

CREATE OR REPLACE VIEW public.v_leg_result_observations_with_pace AS
 SELECT o.id,
    o.year,
    o.runner_id,
    o.leg_number,
    o.leg_version,
    o.source_type,
    o.source_label,
    o.submitted_by_runner_id,
    submitted_by.name AS submitted_by_runner_name,
    o.lap_time,
    o.moving_time,
    o.elapsed_time,
    COALESCE(o.lap_time, o.elapsed_time, o.moving_time) AS primary_time,
        CASE
            WHEN o.lap_time IS NOT NULL THEN 'lap_time'::text
            WHEN o.elapsed_time IS NOT NULL THEN 'elapsed_time'::text
            WHEN o.moving_time IS NOT NULL THEN 'moving_time'::text
            ELSE NULL::text
        END AS primary_time_type,
    o.distance AS observed_distance,
    ld.distance AS canonical_distance,
    COALESCE(o.distance, ld.distance) AS display_distance,
    o.elevation_gain AS observed_elevation_gain,
    ld.elevation_gain AS canonical_elevation_gain,
    COALESCE(o.elevation_gain, ld.elevation_gain) AS display_elevation_gain,
    rn.name AS runner_name,
    rn.auth_user_id,
    public.parse_time_to_minutes(COALESCE(o.lap_time, o.elapsed_time, o.moving_time)) AS time_in_minutes,
        CASE
            WHEN COALESCE(o.distance, ld.distance) > 0::double precision
              THEN public.parse_time_to_minutes(COALESCE(o.lap_time, o.elapsed_time, o.moving_time)) / COALESCE(o.distance, ld.distance)
            ELSE NULL::double precision
        END AS pace,
    EXISTS (
      SELECT 1
      FROM public.results r
      WHERE r.year = o.year
        AND r.leg_number = o.leg_number
    ) AS has_canonical_result,
    canonical_result.user_id AS canonical_runner_id,
    canonical_runner.name AS canonical_runner_name,
    canonical_result.lap_time AS canonical_lap_time,
    o.notes,
    o.raw_metadata,
    o.created_at,
    o.updated_at,
    p.race_start_time
   FROM public.leg_result_observations o
     JOIN public.leg_definitions ld ON o.leg_number = ld.number AND o.leg_version = ld.version
     JOIN public.placements p ON o.year = p.year
     LEFT JOIN public.runners rn ON o.runner_id = rn.id
     LEFT JOIN public.runners submitted_by ON o.submitted_by_runner_id = submitted_by.id
     LEFT JOIN public.results canonical_result ON canonical_result.year = o.year AND canonical_result.leg_number = o.leg_number
     LEFT JOIN public.runners canonical_runner ON canonical_result.user_id = canonical_runner.id;

CREATE OR REPLACE VIEW public.v_yearly_summary AS
 SELECT tps.year,
    tps.total_time,
    tps.average_pace,
    tps.improvement,
    tps.overall_place,
    tps.overall_teams,
    tps.division_place,
    tps.division_teams,
    p.division,
    p.bib,
        CASE
            WHEN tps.overall_teams > 0 THEN tps.overall_place::double precision / tps.overall_teams::double precision * 100::double precision
            ELSE NULL::double precision
        END AS overall_percentile,
        CASE
            WHEN tps.division_teams > 0 THEN tps.division_place::double precision / tps.division_teams::double precision * 100::double precision
            ELSE NULL::double precision
        END AS division_percentile,
    p.notes,
    COALESCE(yp.participant_count, 0::bigint) AS participant_count,
    tps.race_start_time
   FROM public.team_performance_summary tps
     LEFT JOIN public.placements p ON tps.year = p.year
     LEFT JOIN (
       SELECT race_participations.year,
          count(*) AS participant_count
       FROM public.race_participations
       GROUP BY race_participations.year
     ) yp ON tps.year = yp.year;

-- Create a function to convert INTERVAL into minutes.
CREATE OR REPLACE FUNCTION parse_time_to_minutes(time_interval INTERVAL)
RETURNS FLOAT AS $$
BEGIN
  IF time_interval IS NULL THEN
    RETURN 0;
  END IF;
  RETURN EXTRACT(EPOCH FROM time_interval) / 60.0;
END;
$$ LANGUAGE plpgsql;

-- View 1: v_results_with_pace
-- This view joins results with leg definitions and runners, and calculates time in minutes and pace for each result.
-- This forms the base for other statistical views.
CREATE OR REPLACE VIEW v_results_with_pace AS
SELECT
  r.year,
  r.user_id as runner_id,
  r.leg_number,
  r.leg_version,
  r.lap_time,
  ld.distance,
  ld.elevation_gain,
  rn.name as runner_name,
  rn.auth_user_id,
  parse_time_to_minutes(r.lap_time) as time_in_minutes,
  CASE
    WHEN ld.distance > 0 THEN parse_time_to_minutes(r.lap_time) / ld.distance
    ELSE NULL
  END as pace
FROM
  results r
JOIN
  leg_definitions ld ON r.leg_number = ld.number AND r.leg_version = ld.version
LEFT JOIN
  runners rn ON r.user_id = rn.id;


-- View 2: v_runner_stats
-- This view aggregates the data by runner to provide statistics like total races, best/average pace, etc.
-- It simplifies the data processing needed for the Team and Runner Detail views.
CREATE OR REPLACE VIEW v_runner_stats AS
WITH runner_paces AS (
  SELECT
    runner_id,
    runner_name,
    pace
  FROM v_results_with_pace
  WHERE pace IS NOT NULL
)
SELECT
  p.runner_id,
  p.runner_name,
  count(*) as total_races,
  sum(p.time_in_minutes) as total_time_minutes,
  sum(p.distance) as total_distance,
  min(p.pace) as best_pace,
  avg(p.pace) as average_pace,
  min(p.time_in_minutes) as best_time,
  avg(p.time_in_minutes) as average_time,
  count(DISTINCT p.leg_number) as unique_legs,
  count(DISTINCT p.year) as unique_years,
  (SELECT json_agg(json_build_object('leg', leg_number, 'version', leg_version))
   FROM (
     SELECT DISTINCT leg_number, leg_version
     FROM v_results_with_pace
     WHERE runner_id = p.runner_id AND pace = (SELECT min(pace) FROM runner_paces WHERE runner_id = p.runner_id)
   ) AS best_pace_legs
  ) as best_pace_legs_with_versions,
  (SELECT json_agg(json_build_object('leg', leg_number, 'latestVersion', max_version))
   FROM (
     SELECT leg_number, max(leg_version) as max_version
     FROM v_results_with_pace
     WHERE runner_id = p.runner_id
     GROUP BY leg_number
   ) as legs_run
  ) as legs_run
FROM
  v_results_with_pace p
GROUP BY
  p.runner_id, p.runner_name;


-- View 3: v_leg_version_stats
-- This view aggregates data by leg number and version, providing stats for each specific leg configuration.
-- It will simplify the LegsView and LegDetail components.
CREATE OR REPLACE VIEW v_leg_version_stats AS
WITH leg_paces AS (
    SELECT
        leg_number,
        leg_version,
        pace,
        runner_name,
        year
    FROM v_results_with_pace
    WHERE pace IS NOT NULL
)
SELECT
    p.leg_number,
    p.leg_version,
    p.distance,
    p.elevation_gain,
    count(*) as runs,
    sum(p.time_in_minutes) as total_time,
    sum(p.distance) as total_distance,
    min(p.pace) as best_pace,
    avg(p.pace) as average_pace,
    count(DISTINCT p.runner_id) as unique_runners,
    (SELECT json_agg(json_build_object('runner', runner_name, 'year', year))
     FROM leg_paces
     WHERE leg_number = p.leg_number AND leg_version = p.leg_version AND pace = (
         SELECT min(lp.pace) FROM leg_paces lp WHERE lp.leg_number = p.leg_number AND lp.leg_version = p.leg_version
     )
    ) as best_pace_runner_years
FROM
    v_results_with_pace p
GROUP BY
    p.leg_number, p.leg_version, p.distance, p.elevation_gain;

-- View 4: v_yearly_summary
-- This view combines team performance and placement data, calculating percentiles for each year.
-- It will simplify the Dashboard and History views.
CREATE OR REPLACE VIEW v_yearly_summary AS
SELECT
  tps.year,
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
    WHEN tps.overall_teams > 0 THEN (tps.overall_place::float / tps.overall_teams) * 100
    ELSE NULL
  END as overall_percentile,
  CASE
    WHEN tps.division_teams > 0 THEN (tps.division_place::float / tps.division_teams) * 100
    ELSE NULL
  END as division_percentile
FROM
  team_performance_summary tps
LEFT JOIN
  placements p ON tps.year = p.year; 


  create policy "Allow authenticated users to insert placements"
on "public"."placements"
as permissive
for insert
to authenticated
with check (true);


create policy "Allow authenticated users to update placements"
on "public"."placements"
as permissive
for update
to authenticated
using (true);


create policy "Allow authenticated users to insert results"
on "public"."results"
as permissive
for insert
to authenticated
with check (true);


create policy "Allow authenticated users to update results"
on "public"."results"
as permissive
for update
to authenticated
using (true);
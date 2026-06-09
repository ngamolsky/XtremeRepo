-- Add a minimal whole-course race version for apples-to-apples total-time comparisons.
ALTER TABLE public.placements
  ADD COLUMN IF NOT EXISTS race_version smallint NOT NULL DEFAULT 1;

-- The current course boundary already exists in the data as the switch from
-- leg_version 1 to leg_version 2. Keep race_version as the public whole-course
-- comparison boundary and backfill it deterministically from official results
-- or planned race leg assignments.
UPDATE public.placements p
SET race_version = 2
WHERE EXISTS (
  SELECT 1
  FROM public.results r
  WHERE r.year = p.year
    AND r.leg_version = 2
)
OR EXISTS (
  SELECT 1
  FROM public.race_leg_assignments a
  WHERE a.year = p.year
    AND a.leg_version = 2
);

COMMENT ON COLUMN public.placements.race_version IS
  'Whole race/course version. Backfilled from the leg_version 1/2 data boundary so total race times compare only within the same course version.';

CREATE OR REPLACE VIEW public.v_yearly_summary AS
 SELECT p.year,
    tps.total_time,
    tps.average_pace,
    tps.improvement,
    COALESCE(tps.overall_place, p.overall_place) AS overall_place,
    COALESCE(tps.overall_teams, p.overall_teams) AS overall_teams,
    COALESCE(tps.division_place, p.division_place) AS division_place,
    COALESCE(tps.division_teams, p.division_teams) AS division_teams,
    p.division,
    p.bib,
        CASE
            WHEN (COALESCE(tps.overall_teams, p.overall_teams) > 0) THEN (((COALESCE(tps.overall_place, p.overall_place))::double precision / (COALESCE(tps.overall_teams, p.overall_teams))::double precision) * (100)::double precision)
            ELSE NULL::double precision
        END AS overall_percentile,
        CASE
            WHEN (COALESCE(tps.division_teams, p.division_teams) > 0) THEN (((COALESCE(tps.division_place, p.division_place))::double precision / (COALESCE(tps.division_teams, p.division_teams))::double precision) * (100)::double precision)
            ELSE NULL::double precision
        END AS division_percentile,
    COALESCE(yp.participant_count, (0)::bigint) AS participant_count,
    COALESCE(tps.race_start_time, p.race_start_time) AS race_start_time,
    p.race_version
   FROM (public.placements p
     LEFT JOIN public.team_performance_summary tps ON ((tps.year = p.year)))
     LEFT JOIN ( SELECT race_participations.year,
            count(*) AS participant_count
           FROM public.race_participations
          GROUP BY race_participations.year) yp ON ((p.year = yp.year));

GRANT SELECT ON TABLE public.v_yearly_summary TO anon, authenticated;
GRANT ALL ON TABLE public.v_yearly_summary TO service_role;

-- Add optional fun tidbit notes to yearly placements and individual leg runs.
ALTER TABLE public.placements
ADD COLUMN IF NOT EXISTS notes text;

ALTER TABLE public.results
ADD COLUMN IF NOT EXISTS notes text;

CREATE OR REPLACE VIEW public.v_results_with_pace AS
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
            WHEN (ld.distance > (0)::double precision) THEN (public.parse_time_to_minutes(r.lap_time) / ld.distance)
            ELSE NULL::double precision
        END AS pace,
    r.notes
   FROM ((public.results r
     JOIN public.leg_definitions ld ON (((r.leg_number = ld.number) AND (r.leg_version = ld.version))))
     LEFT JOIN public.runners rn ON ((r.user_id = rn.id)));

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
            WHEN (tps.overall_teams > 0) THEN (((tps.overall_place)::double precision / (tps.overall_teams)::double precision) * (100)::double precision)
            ELSE NULL::double precision
        END AS overall_percentile,
        CASE
            WHEN (tps.division_teams > 0) THEN (((tps.division_place)::double precision / (tps.division_teams)::double precision) * (100)::double precision)
            ELSE NULL::double precision
        END AS division_percentile,
    p.notes
   FROM (public.team_performance_summary tps
     LEFT JOIN public.placements p ON ((tps.year = p.year)));

-- Include placement-only race shells in the yearly summary while official results are pending.
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
            WHEN COALESCE(tps.overall_teams, p.overall_teams) > 0 THEN COALESCE(tps.overall_place, p.overall_place)::double precision / COALESCE(tps.overall_teams, p.overall_teams)::double precision * 100::double precision
            ELSE NULL::double precision
        END AS overall_percentile,
        CASE
            WHEN COALESCE(tps.division_teams, p.division_teams) > 0 THEN COALESCE(tps.division_place, p.division_place)::double precision / COALESCE(tps.division_teams, p.division_teams)::double precision * 100::double precision
            ELSE NULL::double precision
        END AS division_percentile,
    COALESCE(yp.participant_count, 0::bigint) AS participant_count,
    COALESCE(tps.race_start_time, p.race_start_time) AS race_start_time
   FROM public.placements p
     LEFT JOIN public.team_performance_summary tps ON tps.year = p.year
     LEFT JOIN (
       SELECT race_participations.year,
          count(*) AS participant_count
       FROM public.race_participations
       GROUP BY race_participations.year
     ) yp ON p.year = yp.year;

GRANT SELECT ON TABLE public.v_yearly_summary TO anon, authenticated;
GRANT ALL ON TABLE public.v_yearly_summary TO service_role;

-- Performance Analytics: Views and calculations for race performance analysis

-- Base view: Results with calculated pace information
CREATE OR REPLACE VIEW "public"."v_results_with_pace" AS
 SELECT "r"."year",
    "r"."user_id" AS "runner_id",
    "r"."leg_number",
    "r"."leg_version",
    "r"."lap_time",
    "ld"."distance",
    "ld"."elevation_gain",
    "rn"."name" AS "runner_name",
    "rn"."auth_user_id",
    "public"."parse_time_to_minutes"("r"."lap_time") AS "time_in_minutes",
        CASE
            WHEN ("ld"."distance" > (0)::double precision) THEN ("public"."parse_time_to_minutes"("r"."lap_time") / "ld"."distance")
            ELSE NULL::double precision
        END AS "pace"
   FROM (("public"."results" "r"
     JOIN "public"."leg_definitions" "ld" ON ((("r"."leg_number" = "ld"."number") AND ("r"."leg_version" = "ld"."version"))))
     LEFT JOIN "public"."runners" "rn" ON (("r"."user_id" = "rn"."id")));

-- Team performance summary with yearly statistics
CREATE OR REPLACE VIEW "public"."team_performance_summary" AS
 WITH "yearly_totals" AS (
         SELECT "r"."year",
            "sum"(EXTRACT(epoch FROM "r"."lap_time")) AS "total_seconds",
            "sum"("ld"."distance") AS "total_distance"
           FROM ("public"."results" "r"
             JOIN "public"."leg_definitions" "ld" ON ((("r"."leg_number" = "ld"."number") AND ("r"."leg_version" = "ld"."version"))))
          GROUP BY "r"."year"
        ), "yearly_stats" AS (
         SELECT "yt"."year",
            "yt"."total_seconds",
            "make_interval"("secs" => ("yt"."total_seconds")::double precision) AS "total_time",
                CASE
                    WHEN ("yt"."total_distance" > (0)::double precision) THEN (("yt"."total_seconds")::double precision / "yt"."total_distance")
                    ELSE NULL::double precision
                END AS "average_pace",
            "p"."division_place",
            "p"."division_teams",
            "p"."overall_place",
            "p"."overall_teams"
           FROM ("yearly_totals" "yt"
             JOIN "public"."placements" "p" ON (("yt"."year" = "p"."year")))
        )
 SELECT "year",
    "total_time",
        CASE
            WHEN ("average_pace" IS NOT NULL) THEN "make_interval"("secs" => "round"("average_pace"))
            ELSE NULL::interval
        END AS "average_pace",
    "division_place",
    "division_teams",
    "overall_place",
    "overall_teams",
    ("lag"("overall_place") OVER (ORDER BY "year") - "overall_place") AS "improvement"
   FROM "yearly_stats"
  ORDER BY "year";

-- Statistics by leg version - shows performance metrics for each race segment
CREATE OR REPLACE VIEW "public"."v_leg_version_stats" AS
 WITH "leg_paces" AS (
         SELECT "v_results_with_pace"."leg_number",
            "v_results_with_pace"."leg_version",
            "v_results_with_pace"."pace",
            "v_results_with_pace"."runner_name",
            "v_results_with_pace"."year"
           FROM "public"."v_results_with_pace"
          WHERE ("v_results_with_pace"."pace" IS NOT NULL)
        )
 SELECT "leg_number",
    "leg_version",
    "distance",
    "elevation_gain",
    "count"(*) AS "runs",
    "sum"("time_in_minutes") AS "total_time",
    "sum"("distance") AS "total_distance",
    "min"("pace") AS "best_pace",
    "avg"("pace") AS "average_pace",
    "count"(DISTINCT "runner_id") AS "unique_runners",
    ( SELECT "json_agg"("json_build_object"('runner', "leg_paces"."runner_name", 'year', "leg_paces"."year")) AS "json_agg"
           FROM "leg_paces"
          WHERE (("leg_paces"."leg_number" = "p"."leg_number") AND ("leg_paces"."leg_version" = "p"."leg_version") AND ("leg_paces"."pace" = ( SELECT "min"("lp"."pace") AS "min"
                   FROM "leg_paces" "lp"
                  WHERE (("lp"."leg_number" = "p"."leg_number") AND ("lp"."leg_version" = "p"."leg_version")))))) AS "best_pace_runner_years"
   FROM "public"."v_results_with_pace" "p"
  GROUP BY "leg_number", "leg_version", "distance", "elevation_gain";

-- Statistics by runner - comprehensive performance metrics for each athlete
CREATE OR REPLACE VIEW "public"."v_runner_stats" AS
 WITH "runner_paces" AS (
         SELECT "v_results_with_pace"."runner_id",
            "v_results_with_pace"."runner_name",
            "v_results_with_pace"."pace"
           FROM "public"."v_results_with_pace"
          WHERE ("v_results_with_pace"."pace" IS NOT NULL)
        )
 SELECT "runner_id",
    "runner_name",
    "count"(*) AS "total_races",
    "sum"("time_in_minutes") AS "total_time_minutes",
    "sum"("distance") AS "total_distance",
    "min"("pace") AS "best_pace",
    "avg"("pace") AS "average_pace",
    "min"("time_in_minutes") AS "best_time",
    "avg"("time_in_minutes") AS "average_time",
    "count"(DISTINCT "leg_number") AS "unique_legs",
    "count"(DISTINCT "year") AS "unique_years",
    ( SELECT "json_agg"("json_build_object"('leg', "best_pace_legs"."leg_number", 'version', "best_pace_legs"."leg_version")) AS "json_agg"
           FROM ( SELECT DISTINCT "v_results_with_pace"."leg_number",
                    "v_results_with_pace"."leg_version"
                   FROM "public"."v_results_with_pace"
                  WHERE (("v_results_with_pace"."runner_id" = "p"."runner_id") AND ("v_results_with_pace"."pace" = ( SELECT "min"("runner_paces"."pace") AS "min"
                           FROM "runner_paces"
                          WHERE ("runner_paces"."runner_id" = "p"."runner_id"))))) "best_pace_legs") AS "best_pace_legs_with_versions",
    ( SELECT "json_agg"("json_build_object"('leg', "legs_run"."leg_number", 'latestVersion', "legs_run"."max_version")) AS "json_agg"
           FROM ( SELECT "v_results_with_pace"."leg_number",
                    "max"("v_results_with_pace"."leg_version") AS "max_version"
                   FROM "public"."v_results_with_pace"
                  WHERE ("v_results_with_pace"."runner_id" = "p"."runner_id")
                  GROUP BY "v_results_with_pace"."leg_number") "legs_run") AS "legs_run"
   FROM "public"."v_results_with_pace" "p"
  GROUP BY "runner_id", "runner_name";

-- Yearly summary with percentiles - comprehensive team performance by year
CREATE OR REPLACE VIEW "public"."v_yearly_summary" AS
 SELECT "tps"."year",
    "tps"."total_time",
    "tps"."average_pace",
    "tps"."improvement",
    "tps"."overall_place",
    "tps"."overall_teams",
    "tps"."division_place",
    "tps"."division_teams",
    "p"."division",
    "p"."bib",
        CASE
            WHEN ("tps"."overall_teams" > 0) THEN ((("tps"."overall_place")::double precision / ("tps"."overall_teams")::double precision) * (100)::double precision)
            ELSE NULL::double precision
        END AS "overall_percentile",
        CASE
            WHEN ("tps"."division_teams" > 0) THEN ((("tps"."division_place")::double precision / ("tps"."division_teams")::double precision) * (100)::double precision)
            ELSE NULL::double precision
        END AS "division_percentile"
   FROM ("public"."team_performance_summary" "tps"
     LEFT JOIN "public"."placements" "p" ON (("tps"."year" = "p"."year"))); 
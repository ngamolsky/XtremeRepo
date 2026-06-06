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
        END AS "pace",
    "r"."notes"
		   FROM (("public"."results" "r"
		     JOIN "public"."leg_definitions" "ld" ON ((("r"."leg_number" = "ld"."number") AND ("r"."leg_version" = "ld"."version"))))
		     LEFT JOIN "public"."runners" "rn" ON (("r"."user_id" = "rn"."id")));

-- Race-year participation with runner names and known-leg status
CREATE OR REPLACE VIEW "public"."v_runner_participations" AS
 SELECT "rp"."year",
    "rp"."runner_id",
    "rn"."name" AS "runner_name",
    "rn"."auth_user_id",
    "rp"."status",
    "rp"."notes",
    EXISTS ( SELECT 1
           FROM "public"."results" "r"
          WHERE (("r"."year" = "rp"."year") AND ("r"."user_id" = "rp"."runner_id"))) AS "has_known_leg",
    COALESCE(( SELECT "json_agg"("json_build_object"('leg_number', "r"."leg_number", 'leg_version', "r"."leg_version", 'lap_time', "r"."lap_time") ORDER BY "r"."leg_number") AS "json_agg"
           FROM "public"."results" "r"
          WHERE (("r"."year" = "rp"."year") AND ("r"."user_id" = "rp"."runner_id"))), '[]'::"json") AS "known_legs"
   FROM ("public"."race_participations" "rp"
     JOIN "public"."runners" "rn" ON (("rp"."runner_id" = "rn"."id")));

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
 WITH "result_stats" AS (
         SELECT "v_results_with_pace"."runner_id",
            "v_results_with_pace"."runner_name",
            "count"(*) AS "known_leg_runs",
            "sum"("v_results_with_pace"."time_in_minutes") AS "total_time_minutes",
            "sum"("v_results_with_pace"."distance") AS "total_distance",
            "min"("v_results_with_pace"."pace") AS "best_pace",
            "avg"("v_results_with_pace"."pace") AS "average_pace",
            "min"("v_results_with_pace"."time_in_minutes") AS "best_time",
            "avg"("v_results_with_pace"."time_in_minutes") AS "average_time",
            "count"(DISTINCT "v_results_with_pace"."leg_number") AS "unique_legs"
	           FROM "public"."v_results_with_pace"
	          WHERE ("v_results_with_pace"."runner_id" IS NOT NULL)
	          GROUP BY "v_results_with_pace"."runner_id", "v_results_with_pace"."runner_name"
	        ), "runner_participation" AS (
         SELECT "rp"."runner_id",
            "rn"."name" AS "runner_name",
            "count"(*) AS "total_races",
            "count"(DISTINCT "rp"."year") AS "unique_years",
            "json_agg"("rp"."year" ORDER BY "rp"."year") AS "participation_years"
           FROM ("public"."race_participations" "rp"
             JOIN "public"."runners" "rn" ON (("rp"."runner_id" = "rn"."id")))
          GROUP BY "rp"."runner_id", "rn"."name"
        ), "runner_paces" AS (
         SELECT "v_results_with_pace"."runner_id",
            "v_results_with_pace"."runner_name",
            "v_results_with_pace"."pace"
           FROM "public"."v_results_with_pace"
          WHERE (("v_results_with_pace"."pace" IS NOT NULL) AND ("v_results_with_pace"."runner_id" IS NOT NULL))
	        )
 SELECT "p"."runner_id",
    "p"."runner_name",
    "p"."total_races",
    "rs"."total_time_minutes",
    "rs"."total_distance",
    "rs"."best_pace",
    "rs"."average_pace",
    "rs"."best_time",
    "rs"."average_time",
    COALESCE("rs"."unique_legs", (0)::bigint) AS "unique_legs",
    "p"."unique_years",
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
	                  GROUP BY "v_results_with_pace"."leg_number") "legs_run") AS "legs_run",
    "p"."participation_years",
    COALESCE("rs"."known_leg_runs", (0)::bigint) AS "known_leg_runs",
    COALESCE(( SELECT "json_agg"("rp"."year" ORDER BY "rp"."year") AS "json_agg"
           FROM "public"."race_participations" "rp"
          WHERE (("rp"."runner_id" = "p"."runner_id") AND (NOT (EXISTS ( SELECT 1
                   FROM "public"."results" "r"
                  WHERE (("r"."year" = "rp"."year") AND ("r"."user_id" = "rp"."runner_id"))))))), '[]'::"json") AS "unknown_leg_years"
   FROM ("runner_participation" "p"
     LEFT JOIN "result_stats" "rs" ON (("p"."runner_id" = "rs"."runner_id")));

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
        END AS "division_percentile",
    "p"."notes",
    COALESCE("yp"."participant_count", (0)::bigint) AS "participant_count"
	   FROM ("public"."team_performance_summary" "tps"
	     LEFT JOIN "public"."placements" "p" ON (("tps"."year" = "p"."year")))
	     LEFT JOIN ( SELECT "race_participations"."year",
            "count"(*) AS "participant_count"
           FROM "public"."race_participations"
          GROUP BY "race_participations"."year") "yp" ON (("tps"."year" = "yp"."year"));

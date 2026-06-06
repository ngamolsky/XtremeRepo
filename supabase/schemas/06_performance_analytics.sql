-- Performance Analytics: Views and calculations for race performance analysis

-- Base view: Results with calculated pace information
CREATE OR REPLACE VIEW "public"."v_results_with_pace" AS
 WITH "ordered_results" AS (
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
            "r"."notes",
            "r"."source_type",
            "r"."canonical_observation_id",
            "p"."race_start_time",
            COALESCE(sum(COALESCE("r"."lap_time", '00:00:00'::interval)) OVER (PARTITION BY "r"."year" ORDER BY "r"."leg_number" ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING), '00:00:00'::interval) AS "elapsed_before_leg",
            COALESCE(sum(COALESCE("r"."lap_time", '00:00:00'::interval)) OVER (PARTITION BY "r"."year" ORDER BY "r"."leg_number" ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW), '00:00:00'::interval) AS "elapsed_through_leg"
           FROM ((("public"."results" "r"
             JOIN "public"."leg_definitions" "ld" ON ((("r"."leg_number" = "ld"."number") AND ("r"."leg_version" = "ld"."version"))))
             JOIN "public"."placements" "p" ON (("r"."year" = "p"."year")))
             LEFT JOIN "public"."runners" "rn" ON (("r"."user_id" = "rn"."id")))
        )
 SELECT "year",
    "runner_id",
    "leg_number",
    "leg_version",
    "lap_time",
    "distance",
    "elevation_gain",
    "runner_name",
    "auth_user_id",
    "time_in_minutes",
    "pace",
    "notes",
    "source_type",
    "canonical_observation_id",
    "race_start_time",
    ("race_start_time" + "elapsed_before_leg") AS "leg_start_time",
    ("race_start_time" + "elapsed_through_leg") AS "leg_finish_time"
   FROM "ordered_results";

-- Non-canonical runner/device observations with calculated pace and canonical suppression flag
CREATE OR REPLACE VIEW "public"."v_leg_result_observations_with_pace" AS
 SELECT "o"."id",
    "o"."year",
    "o"."runner_id",
    "o"."leg_number",
    "o"."leg_version",
    "o"."source_type",
    "o"."source_label",
    "o"."submitted_by_runner_id",
    "submitted_by"."name" AS "submitted_by_runner_name",
    "o"."lap_time",
    "o"."moving_time",
    "o"."elapsed_time",
    COALESCE("o"."lap_time", "o"."elapsed_time", "o"."moving_time") AS "primary_time",
        CASE
            WHEN ("o"."lap_time" IS NOT NULL) THEN 'lap_time'::"text"
            WHEN ("o"."elapsed_time" IS NOT NULL) THEN 'elapsed_time'::"text"
            WHEN ("o"."moving_time" IS NOT NULL) THEN 'moving_time'::"text"
            ELSE NULL::"text"
        END AS "primary_time_type",
    "o"."distance" AS "observed_distance",
    "ld"."distance" AS "canonical_distance",
    COALESCE("o"."distance", "ld"."distance") AS "display_distance",
    "o"."elevation_gain" AS "observed_elevation_gain",
    "ld"."elevation_gain" AS "canonical_elevation_gain",
    COALESCE("o"."elevation_gain", "ld"."elevation_gain") AS "display_elevation_gain",
    "rn"."name" AS "runner_name",
    "rn"."auth_user_id",
    "public"."parse_time_to_minutes"(COALESCE("o"."lap_time", "o"."elapsed_time", "o"."moving_time")) AS "time_in_minutes",
        CASE
            WHEN (COALESCE("o"."distance", "ld"."distance") > (0)::double precision) THEN ("public"."parse_time_to_minutes"(COALESCE("o"."lap_time", "o"."elapsed_time", "o"."moving_time")) / COALESCE("o"."distance", "ld"."distance"))
            ELSE NULL::double precision
        END AS "pace",
    EXISTS ( SELECT 1
           FROM "public"."results" "r"
          WHERE (("r"."year" = "o"."year") AND ("r"."leg_number" = "o"."leg_number"))) AS "has_canonical_result",
    "canonical_result"."user_id" AS "canonical_runner_id",
    "canonical_runner"."name" AS "canonical_runner_name",
    "canonical_result"."lap_time" AS "canonical_lap_time",
    "o"."notes",
    "o"."raw_metadata",
    "o"."created_at",
    "o"."updated_at",
    "p"."race_start_time"
   FROM (((((("public"."leg_result_observations" "o"
     JOIN "public"."leg_definitions" "ld" ON ((("o"."leg_number" = "ld"."number") AND ("o"."leg_version" = "ld"."version"))))
     JOIN "public"."placements" "p" ON (("o"."year" = "p"."year")))
     LEFT JOIN "public"."runners" "rn" ON (("o"."runner_id" = "rn"."id")))
     LEFT JOIN "public"."runners" "submitted_by" ON (("o"."submitted_by_runner_id" = "submitted_by"."id")))
     LEFT JOIN "public"."results" "canonical_result" ON ((("canonical_result"."year" = "o"."year") AND ("canonical_result"."leg_number" = "o"."leg_number"))))
     LEFT JOIN "public"."runners" "canonical_runner" ON (("canonical_result"."user_id" = "canonical_runner"."id")));

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
            "p"."overall_teams",
            "p"."race_start_time"
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
    ("lag"("overall_place") OVER (ORDER BY "year") - "overall_place") AS "improvement",
    "race_start_time"
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
    COALESCE("yp"."participant_count", (0)::bigint) AS "participant_count",
    "tps"."race_start_time"
	   FROM ("public"."team_performance_summary" "tps"
	     LEFT JOIN "public"."placements" "p" ON (("tps"."year" = "p"."year")))
	     LEFT JOIN ( SELECT "race_participations"."year",
            "count"(*) AS "participant_count"
           FROM "public"."race_participations"
          GROUP BY "race_participations"."year") "yp" ON (("tps"."year" = "yp"."year"));

-- Keep provisional/self-recorded distance and elevation display fields strictly provisional.
-- Missing observed values should remain NULL so the UI renders N/A instead of
-- falling back to canonical leg definition values.

-- Non-canonical runner/device observations with calculated pace and canonical suppression flag
CREATE OR REPLACE VIEW "public"."v_leg_result_observations_with_pace" AS
 SELECT "o"."id",
    "o"."year",
    "o"."runner_id",
    "o"."leg_number",
    "o"."leg_version",
    "o"."source_type",
    "o"."source_label",
    "o"."source_tags",
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
    "o"."distance" AS "display_distance",
    "o"."elevation_gain" AS "observed_elevation_gain",
    "ld"."elevation_gain" AS "canonical_elevation_gain",
    "o"."elevation_gain" AS "display_elevation_gain",
    "rn"."name" AS "runner_name",
    "rn"."auth_user_id",
    "public"."parse_time_to_minutes"(COALESCE("o"."lap_time", "o"."elapsed_time", "o"."moving_time")) AS "time_in_minutes",
        CASE
            WHEN ("o"."distance" > (0)::double precision) THEN ("public"."parse_time_to_minutes"(COALESCE("o"."lap_time", "o"."elapsed_time", "o"."moving_time")) / "o"."distance")
            ELSE NULL::double precision
        END AS "pace",
    EXISTS ( SELECT 1
           FROM "public"."results" "r"
          WHERE (("r"."year" = "o"."year") AND ("r"."leg_number" = "o"."leg_number"))) AS "has_canonical_result",
    "canonical_result"."user_id" AS "canonical_runner_id",
    "canonical_runner"."name" AS "canonical_runner_name",
    "canonical_result"."lap_time" AS "canonical_lap_time",
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

GRANT SELECT ON TABLE public.v_leg_result_observations_with_pace TO anon, authenticated;
GRANT ALL ON TABLE public.v_leg_result_observations_with_pace TO service_role;

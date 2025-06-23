

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."link_runner_to_auth_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    -- Try to find and update a runner with matching email
    UPDATE public.runners
    SET auth_user_id = NEW.id
    WHERE email = NEW.email
    AND auth_user_id IS NULL;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."link_runner_to_auth_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."parse_time_to_minutes"("time_interval" interval) RETURNS double precision
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
  IF time_interval IS NULL THEN
    RETURN 0;
  END IF;
  RETURN EXTRACT(EPOCH FROM time_interval) / 60.0;
END;
$$;


ALTER FUNCTION "public"."parse_time_to_minutes"("time_interval" interval) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."leg_definitions" (
    "number" smallint NOT NULL,
    "version" smallint NOT NULL,
    "distance" double precision,
    "elevation_gain" smallint
);


ALTER TABLE "public"."leg_definitions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."placements" (
    "year" smallint NOT NULL,
    "division" "text",
    "division_place" smallint,
    "division_teams" smallint,
    "overall_place" smallint,
    "overall_teams" smallint,
    "bib" smallint
);


ALTER TABLE "public"."placements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."results" (
    "year" smallint NOT NULL,
    "leg_number" smallint NOT NULL,
    "leg_version" smallint NOT NULL,
    "lap_time" interval,
    "user_id" "uuid"
);


ALTER TABLE "public"."results" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."runners" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text",
    "name" "text" NOT NULL,
    "auth_user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."runners" OWNER TO "postgres";


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


ALTER VIEW "public"."team_performance_summary" OWNER TO "postgres";


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


ALTER VIEW "public"."v_results_with_pace" OWNER TO "postgres";


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


ALTER VIEW "public"."v_leg_version_stats" OWNER TO "postgres";


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


ALTER VIEW "public"."v_runner_stats" OWNER TO "postgres";


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


ALTER VIEW "public"."v_yearly_summary" OWNER TO "postgres";


ALTER TABLE ONLY "public"."leg_definitions"
    ADD CONSTRAINT "leg_definitions_pkey" PRIMARY KEY ("number", "version");



ALTER TABLE ONLY "public"."placements"
    ADD CONSTRAINT "placements_pkey" PRIMARY KEY ("year");



ALTER TABLE ONLY "public"."results"
    ADD CONSTRAINT "results_pkey" PRIMARY KEY ("year", "leg_number");



ALTER TABLE ONLY "public"."runners"
    ADD CONSTRAINT "runners_email_unique" UNIQUE ("email");



ALTER TABLE ONLY "public"."runners"
    ADD CONSTRAINT "runners_pkey" PRIMARY KEY ("id");



CREATE OR REPLACE TRIGGER "update_runners_updated_at" BEFORE UPDATE ON "public"."runners" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."results"
    ADD CONSTRAINT "results_leg_definitions_fkey" FOREIGN KEY ("leg_number", "leg_version") REFERENCES "public"."leg_definitions"("number", "version");



ALTER TABLE ONLY "public"."results"
    ADD CONSTRAINT "results_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."runners"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."results"
    ADD CONSTRAINT "results_year_fkey" FOREIGN KEY ("year") REFERENCES "public"."placements"("year");



ALTER TABLE ONLY "public"."runners"
    ADD CONSTRAINT "runners_auth_user_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



CREATE POLICY "Allow authenticated users to read leg_definitions" ON "public"."leg_definitions" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated users to read placements" ON "public"."placements" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated users to read results" ON "public"."results" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated users to read runners" ON "public"."runners" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."leg_definitions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."placements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."results" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."runners" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";





GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";































































































































































GRANT ALL ON FUNCTION "public"."link_runner_to_auth_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."link_runner_to_auth_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."link_runner_to_auth_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."parse_time_to_minutes"("time_interval" interval) TO "anon";
GRANT ALL ON FUNCTION "public"."parse_time_to_minutes"("time_interval" interval) TO "authenticated";
GRANT ALL ON FUNCTION "public"."parse_time_to_minutes"("time_interval" interval) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";


















GRANT MAINTAIN ON TABLE "public"."leg_definitions" TO "anon";
GRANT ALL ON TABLE "public"."leg_definitions" TO "authenticated";
GRANT ALL ON TABLE "public"."leg_definitions" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."placements" TO "anon";
GRANT ALL ON TABLE "public"."placements" TO "authenticated";
GRANT ALL ON TABLE "public"."placements" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."results" TO "anon";
GRANT ALL ON TABLE "public"."results" TO "authenticated";
GRANT ALL ON TABLE "public"."results" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."runners" TO "anon";
GRANT ALL ON TABLE "public"."runners" TO "authenticated";
GRANT ALL ON TABLE "public"."runners" TO "service_role";



GRANT ALL ON TABLE "public"."team_performance_summary" TO "anon";
GRANT ALL ON TABLE "public"."team_performance_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."team_performance_summary" TO "service_role";



GRANT ALL ON TABLE "public"."v_results_with_pace" TO "anon";
GRANT ALL ON TABLE "public"."v_results_with_pace" TO "authenticated";
GRANT ALL ON TABLE "public"."v_results_with_pace" TO "service_role";



GRANT ALL ON TABLE "public"."v_leg_version_stats" TO "anon";
GRANT ALL ON TABLE "public"."v_leg_version_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."v_leg_version_stats" TO "service_role";



GRANT ALL ON TABLE "public"."v_runner_stats" TO "anon";
GRANT ALL ON TABLE "public"."v_runner_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."v_runner_stats" TO "service_role";



GRANT ALL ON TABLE "public"."v_yearly_summary" TO "anon";
GRANT ALL ON TABLE "public"."v_yearly_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."v_yearly_summary" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";






























RESET ALL;

--
-- Dumped schema changes for auth and storage
--

CREATE OR REPLACE TRIGGER "on_auth_user_created" AFTER INSERT ON "auth"."users" FOR EACH ROW EXECUTE FUNCTION "public"."link_runner_to_auth_user"();




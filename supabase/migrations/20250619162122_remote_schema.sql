

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


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";





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
    "runner" "text",
    "lap_time" interval
);


ALTER TABLE "public"."results" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."team_performance_summary" WITH ("security_invoker"='on') AS
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


ALTER TABLE ONLY "public"."leg_definitions"
    ADD CONSTRAINT "leg_definitions_pkey" PRIMARY KEY ("number", "version");



ALTER TABLE ONLY "public"."placements"
    ADD CONSTRAINT "placements_pkey" PRIMARY KEY ("year");



ALTER TABLE ONLY "public"."results"
    ADD CONSTRAINT "results_pkey" PRIMARY KEY ("year", "leg_number");



ALTER TABLE ONLY "public"."results"
    ADD CONSTRAINT "results_leg_definitions_fkey" FOREIGN KEY ("leg_number", "leg_version") REFERENCES "public"."leg_definitions"("number", "version");



ALTER TABLE ONLY "public"."results"
    ADD CONSTRAINT "results_year_fkey" FOREIGN KEY ("year") REFERENCES "public"."placements"("year");



CREATE POLICY "Allow authenticated users to read leg_definitions" ON "public"."leg_definitions" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated users to read placements" ON "public"."placements" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated users to read results" ON "public"."results" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Enable read access for all authed users" ON "public"."leg_definitions" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."leg_definitions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."placements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."results" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";








































































































































































GRANT ALL ON TABLE "public"."leg_definitions" TO "anon";
GRANT ALL ON TABLE "public"."leg_definitions" TO "authenticated";
GRANT ALL ON TABLE "public"."leg_definitions" TO "service_role";



GRANT ALL ON TABLE "public"."placements" TO "anon";
GRANT ALL ON TABLE "public"."placements" TO "authenticated";
GRANT ALL ON TABLE "public"."placements" TO "service_role";



GRANT ALL ON TABLE "public"."results" TO "anon";
GRANT ALL ON TABLE "public"."results" TO "authenticated";
GRANT ALL ON TABLE "public"."results" TO "service_role";



GRANT ALL ON TABLE "public"."team_performance_summary" TO "anon";
GRANT ALL ON TABLE "public"."team_performance_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."team_performance_summary" TO "service_role";









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

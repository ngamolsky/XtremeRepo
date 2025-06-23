-- Race Results: Everything related to individual race performance data

-- Function to convert time intervals to minutes for calculations
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

-- Results - individual race results linking runners to their performance on specific legs
CREATE TABLE IF NOT EXISTS "public"."results" (
    "year" smallint NOT NULL,
    "leg_number" smallint NOT NULL,
    "leg_version" smallint NOT NULL,
    "lap_time" interval,
    "user_id" "uuid"
);

-- Primary key constraint
ALTER TABLE ONLY "public"."results"
    ADD CONSTRAINT "results_pkey" PRIMARY KEY ("year", "leg_number");

-- Foreign key constraints
ALTER TABLE ONLY "public"."results"
    ADD CONSTRAINT "results_leg_definitions_fkey" FOREIGN KEY ("leg_number", "leg_version") REFERENCES "public"."leg_definitions"("number", "version");

ALTER TABLE ONLY "public"."results"
    ADD CONSTRAINT "results_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."runners"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."results"
    ADD CONSTRAINT "results_year_fkey" FOREIGN KEY ("year") REFERENCES "public"."placements"("year");

-- Row Level Security
ALTER TABLE "public"."results" ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Allow authenticated users to read results
CREATE POLICY "Allow authenticated users to read results" 
    ON "public"."results" FOR SELECT TO "authenticated" USING (true); 
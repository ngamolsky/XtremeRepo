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
    "user_id" "uuid",
    "notes" "text"
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

-- Function to ensure every known leg result also counts as race-year participation
CREATE OR REPLACE FUNCTION "public"."ensure_result_participation"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
  IF NEW.user_id IS NOT NULL THEN
    INSERT INTO public.race_participations (year, runner_id)
    VALUES (NEW.year, NEW.user_id)
    ON CONFLICT (year, runner_id) DO UPDATE
    SET updated_at = now();
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER "ensure_result_participation"
    AFTER INSERT OR UPDATE OF "year", "user_id" ON "public"."results"
    FOR EACH ROW EXECUTE FUNCTION "public"."ensure_result_participation"();

-- Row Level Security
ALTER TABLE "public"."results" ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Allow authenticated users to read results
CREATE POLICY "Allow authenticated users to read results" 
    ON "public"."results" FOR SELECT TO "authenticated" USING (true);

CREATE POLICY "Allow authenticated users to insert results"
    ON "public"."results" FOR INSERT TO "authenticated" WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update results"
    ON "public"."results" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);

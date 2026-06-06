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
    "notes" "text",
    "source_type" "text" DEFAULT 'official'::"text" NOT NULL,
    "canonical_observation_id" "uuid"
);

-- Runner/device observations - non-canonical data for display until official results exist
CREATE TABLE IF NOT EXISTS "public"."leg_result_observations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "year" smallint NOT NULL,
    "leg_number" smallint NOT NULL,
    "leg_version" smallint NOT NULL,
    "runner_id" "uuid",
    "source_type" "text" DEFAULT 'manual_runner'::"text" NOT NULL,
    "source_label" "text",
    "submitted_by_runner_id" "uuid",
    "lap_time" interval,
    "moving_time" interval,
    "elapsed_time" interval,
    "distance" double precision,
    "elevation_gain" smallint,
    "notes" "text",
    "raw_metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

-- Primary key constraint
ALTER TABLE ONLY "public"."results"
    ADD CONSTRAINT "results_pkey" PRIMARY KEY ("year", "leg_number");

ALTER TABLE ONLY "public"."leg_result_observations"
    ADD CONSTRAINT "leg_result_observations_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."results"
    ADD CONSTRAINT "results_source_type_check" CHECK (("source_type" = ANY (ARRAY['official'::"text", 'apple_watch'::"text", 'garmin'::"text", 'phone'::"text", 'strava'::"text", 'manual_runner'::"text", 'manual_admin'::"text", 'other'::"text"])));

ALTER TABLE ONLY "public"."leg_result_observations"
    ADD CONSTRAINT "leg_result_observations_source_type_check" CHECK (("source_type" = ANY (ARRAY['apple_watch'::"text", 'garmin'::"text", 'phone'::"text", 'strava'::"text", 'manual_runner'::"text", 'manual_admin'::"text", 'other'::"text"])));

ALTER TABLE ONLY "public"."leg_result_observations"
    ADD CONSTRAINT "leg_result_observations_distance_check" CHECK ((("distance" IS NULL) OR ("distance" > (0)::double precision)));

ALTER TABLE ONLY "public"."leg_result_observations"
    ADD CONSTRAINT "leg_result_observations_lap_time_check" CHECK ((("lap_time" IS NULL) OR ("lap_time" > '00:00:00'::interval)));

ALTER TABLE ONLY "public"."leg_result_observations"
    ADD CONSTRAINT "leg_result_observations_moving_time_check" CHECK ((("moving_time" IS NULL) OR ("moving_time" > '00:00:00'::interval)));

ALTER TABLE ONLY "public"."leg_result_observations"
    ADD CONSTRAINT "leg_result_observations_elapsed_time_check" CHECK ((("elapsed_time" IS NULL) OR ("elapsed_time" > '00:00:00'::interval)));

ALTER TABLE ONLY "public"."leg_result_observations"
    ADD CONSTRAINT "leg_result_observations_raw_metadata_check" CHECK (("jsonb_typeof"("raw_metadata") = 'object'::"text"));

-- Foreign key constraints
ALTER TABLE ONLY "public"."results"
    ADD CONSTRAINT "results_leg_definitions_fkey" FOREIGN KEY ("leg_number", "leg_version") REFERENCES "public"."leg_definitions"("number", "version");

ALTER TABLE ONLY "public"."results"
    ADD CONSTRAINT "results_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."runners"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."results"
    ADD CONSTRAINT "results_year_fkey" FOREIGN KEY ("year") REFERENCES "public"."placements"("year");

ALTER TABLE ONLY "public"."results"
    ADD CONSTRAINT "results_canonical_observation_id_fkey" FOREIGN KEY ("canonical_observation_id") REFERENCES "public"."leg_result_observations"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."leg_result_observations"
    ADD CONSTRAINT "leg_result_observations_leg_definitions_fkey" FOREIGN KEY ("leg_number", "leg_version") REFERENCES "public"."leg_definitions"("number", "version");

ALTER TABLE ONLY "public"."leg_result_observations"
    ADD CONSTRAINT "leg_result_observations_year_fkey" FOREIGN KEY ("year") REFERENCES "public"."placements"("year") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."leg_result_observations"
    ADD CONSTRAINT "leg_result_observations_runner_id_fkey" FOREIGN KEY ("runner_id") REFERENCES "public"."runners"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."leg_result_observations"
    ADD CONSTRAINT "leg_result_observations_submitted_by_runner_id_fkey" FOREIGN KEY ("submitted_by_runner_id") REFERENCES "public"."runners"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "leg_result_observations_year_leg_idx"
    ON "public"."leg_result_observations" USING "btree" ("year", "leg_number", "leg_version");

CREATE INDEX IF NOT EXISTS "leg_result_observations_runner_id_idx"
    ON "public"."leg_result_observations" USING "btree" ("runner_id");

CREATE INDEX IF NOT EXISTS "leg_result_observations_source_type_idx"
    ON "public"."leg_result_observations" USING "btree" ("source_type");

CREATE OR REPLACE TRIGGER "update_leg_result_observations_updated_at"
    BEFORE UPDATE ON "public"."leg_result_observations"
    FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

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
ALTER TABLE "public"."leg_result_observations" ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Allow authenticated users to read results
CREATE POLICY "Allow authenticated users to read results" 
    ON "public"."results" FOR SELECT TO "authenticated" USING (true);

CREATE POLICY "Allow authenticated users to insert results"
    ON "public"."results" FOR INSERT TO "authenticated" WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update results"
    ON "public"."results" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated users to read leg_result_observations"
    ON "public"."leg_result_observations" FOR SELECT TO "authenticated" USING (true);

CREATE POLICY "Allow authenticated users to insert leg_result_observations"
    ON "public"."leg_result_observations" FOR INSERT TO "authenticated" WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update leg_result_observations"
    ON "public"."leg_result_observations" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);

-- Team Placements: Everything related to team standings and competition results

-- Placements - team placement information by year
CREATE TABLE IF NOT EXISTS "public"."placements" (
    "year" smallint NOT NULL,
    "division" "text",
    "division_place" smallint,
    "division_teams" smallint,
    "overall_place" smallint,
    "overall_teams" smallint,
    "bib" smallint,
    "race_start_time" time without time zone DEFAULT '07:00:00'::time NOT NULL,
    "race_version" smallint DEFAULT 1 NOT NULL
);

-- Primary key constraint
ALTER TABLE ONLY "public"."placements"
    ADD CONSTRAINT "placements_pkey" PRIMARY KEY ("year");

-- Row Level Security
ALTER TABLE "public"."placements" ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Allow authenticated users to read placements
CREATE POLICY "Allow authenticated users to read placements" 
    ON "public"."placements" FOR SELECT TO "authenticated" USING (true);

CREATE POLICY "Allow authenticated users to insert placements"
    ON "public"."placements" FOR INSERT TO "authenticated" WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update placements"
    ON "public"."placements" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);

-- Race participations - year rosters independent from known leg assignments
CREATE TABLE IF NOT EXISTS "public"."race_participations" (
    "year" smallint NOT NULL,
    "runner_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'confirmed'::"text" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

-- Primary key and constraints
ALTER TABLE ONLY "public"."race_participations"
    ADD CONSTRAINT "race_participations_pkey" PRIMARY KEY ("year", "runner_id");

ALTER TABLE ONLY "public"."race_participations"
    ADD CONSTRAINT "race_participations_status_check" CHECK (("status" = ANY (ARRAY['confirmed'::"text", 'tentative'::"text"])));

ALTER TABLE ONLY "public"."race_participations"
    ADD CONSTRAINT "race_participations_year_fkey" FOREIGN KEY ("year") REFERENCES "public"."placements"("year") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."race_participations"
    ADD CONSTRAINT "race_participations_runner_id_fkey" FOREIGN KEY ("runner_id") REFERENCES "public"."runners"("id") ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS "race_participations_runner_id_idx"
    ON "public"."race_participations" USING "btree" ("runner_id");

CREATE OR REPLACE TRIGGER "update_race_participations_updated_at"
    BEFORE UPDATE ON "public"."race_participations"
    FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

-- Row Level Security
ALTER TABLE "public"."race_participations" ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Allow authenticated users to manage race participations
CREATE POLICY "Allow authenticated users to read race_participations"
    ON "public"."race_participations" FOR SELECT TO "authenticated" USING (true);

CREATE POLICY "Allow authenticated users to insert race_participations"
    ON "public"."race_participations" FOR INSERT TO "authenticated" WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update race_participations"
    ON "public"."race_participations" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);

-- Planned race-day leg assignments, separate from official results
CREATE TABLE IF NOT EXISTS "public"."race_leg_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "year" smallint NOT NULL,
    "leg_number" smallint NOT NULL,
    "leg_version" smallint NOT NULL,
    "runner_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'planned'::"text" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."race_leg_assignments"
    ADD CONSTRAINT "race_leg_assignments_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."race_leg_assignments"
    ADD CONSTRAINT "race_leg_assignments_year_leg_key" UNIQUE ("year", "leg_number");

ALTER TABLE ONLY "public"."race_leg_assignments"
    ADD CONSTRAINT "race_leg_assignments_status_check" CHECK (("status" = ANY (ARRAY['planned'::"text", 'ran'::"text", 'changed'::"text", 'scratched'::"text"])));

ALTER TABLE ONLY "public"."race_leg_assignments"
    ADD CONSTRAINT "race_leg_assignments_year_fkey" FOREIGN KEY ("year") REFERENCES "public"."placements"("year") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."race_leg_assignments"
    ADD CONSTRAINT "race_leg_assignments_leg_definitions_fkey" FOREIGN KEY ("leg_number", "leg_version") REFERENCES "public"."leg_definitions"("number", "version");

ALTER TABLE ONLY "public"."race_leg_assignments"
    ADD CONSTRAINT "race_leg_assignments_runner_id_fkey" FOREIGN KEY ("runner_id") REFERENCES "public"."runners"("id") ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS "race_leg_assignments_runner_id_idx"
    ON "public"."race_leg_assignments" USING "btree" ("runner_id");

CREATE INDEX IF NOT EXISTS "race_leg_assignments_year_idx"
    ON "public"."race_leg_assignments" USING "btree" ("year");

CREATE OR REPLACE TRIGGER "update_race_leg_assignments_updated_at"
    BEFORE UPDATE ON "public"."race_leg_assignments"
    FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE OR REPLACE FUNCTION "public"."ensure_assignment_participation"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
  IF NEW.status <> 'scratched' THEN
    INSERT INTO public.race_participations (year, runner_id, status)
    VALUES (NEW.year, NEW.runner_id, 'confirmed')
    ON CONFLICT (year, runner_id) DO UPDATE
    SET status = CASE
          WHEN public.race_participations.status = 'tentative' THEN 'confirmed'
          ELSE public.race_participations.status
        END,
        updated_at = now();
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER "ensure_assignment_participation"
    AFTER INSERT OR UPDATE OF "year", "runner_id", "status" ON "public"."race_leg_assignments"
    FOR EACH ROW EXECUTE FUNCTION "public"."ensure_assignment_participation"();

ALTER TABLE "public"."race_leg_assignments" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read race_leg_assignments"
    ON "public"."race_leg_assignments" FOR SELECT TO "authenticated" USING (true);

CREATE POLICY "Allow authenticated users to insert race_leg_assignments"
    ON "public"."race_leg_assignments" FOR INSERT TO "authenticated" WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update race_leg_assignments"
    ON "public"."race_leg_assignments" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete race_leg_assignments"
    ON "public"."race_leg_assignments" FOR DELETE TO "authenticated" USING (true);

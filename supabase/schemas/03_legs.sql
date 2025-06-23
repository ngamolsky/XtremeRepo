-- Race Structure: Everything related to race course definition

-- Leg definitions - defines the race segments with distance and elevation
CREATE TABLE IF NOT EXISTS "public"."leg_definitions" (
    "number" smallint NOT NULL,
    "version" smallint NOT NULL,
    "distance" double precision,
    "elevation_gain" smallint
);

-- Primary key constraint
ALTER TABLE ONLY "public"."leg_definitions"
    ADD CONSTRAINT "leg_definitions_pkey" PRIMARY KEY ("number", "version");

-- Row Level Security
ALTER TABLE "public"."leg_definitions" ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Allow authenticated users to read leg definitions
CREATE POLICY "Allow authenticated users to read leg_definitions" 
    ON "public"."leg_definitions" FOR SELECT TO "authenticated" USING (true); 
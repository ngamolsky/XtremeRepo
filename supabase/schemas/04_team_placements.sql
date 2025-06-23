-- Team Placements: Everything related to team standings and competition results

-- Placements - team placement information by year
CREATE TABLE IF NOT EXISTS "public"."placements" (
    "year" smallint NOT NULL,
    "division" "text",
    "division_place" smallint,
    "division_teams" smallint,
    "overall_place" smallint,
    "overall_teams" smallint,
    "bib" smallint
);

-- Primary key constraint
ALTER TABLE ONLY "public"."placements"
    ADD CONSTRAINT "placements_pkey" PRIMARY KEY ("year");

-- Row Level Security
ALTER TABLE "public"."placements" ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Allow authenticated users to read placements
CREATE POLICY "Allow authenticated users to read placements" 
    ON "public"."placements" FOR SELECT TO "authenticated" USING (true); 
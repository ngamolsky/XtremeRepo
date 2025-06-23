-- Photos: Everything related to race and runner photos

-- Photos table - stores photo metadata and relationships
CREATE TABLE IF NOT EXISTS "public"."photos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "year" smallint NOT NULL,
    "leg_number" smallint,
    "leg_version" smallint,
    "storage_path" "text" NOT NULL,
    "file_name" "text" NOT NULL,
    "file_size" bigint,
    "mime_type" "text",
    "caption" "text",
    "category" "text" CHECK (category IN ('action', 'team', 'celebration', 'preparation', 'finish', 'start', 'candid', 'awards')),
    "is_public" boolean DEFAULT true,
    "uploaded_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

-- Primary key constraint
ALTER TABLE ONLY "public"."photos"
    ADD CONSTRAINT "photos_pkey" PRIMARY KEY ("id");

-- Foreign key constraints
ALTER TABLE ONLY "public"."photos"
    ADD CONSTRAINT "photos_leg_number_fkey" FOREIGN KEY ("leg_number", "leg_version") REFERENCES "public"."leg_definitions"("number", "version");

ALTER TABLE ONLY "public"."photos"
    ADD CONSTRAINT "photos_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "auth"."users"("id");

-- Indexes for performance
CREATE INDEX IF NOT EXISTS "photos_year_idx" ON "public"."photos" USING btree ("year");
CREATE INDEX IF NOT EXISTS "photos_leg_number_idx" ON "public"."photos" USING btree ("leg_number");
CREATE INDEX IF NOT EXISTS "photos_category_idx" ON "public"."photos" USING btree ("category");
CREATE INDEX IF NOT EXISTS "photos_is_public_idx" ON "public"."photos" USING btree ("is_public");
CREATE INDEX IF NOT EXISTS "photos_uploaded_by_idx" ON "public"."photos" USING btree ("uploaded_by");
CREATE INDEX IF NOT EXISTS "photos_created_at_idx" ON "public"."photos" USING btree ("created_at");

-- Enable RLS
ALTER TABLE "public"."photos" ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Allow everyone to read public photos
CREATE POLICY "Public photos are viewable by everyone" ON "public"."photos"
    FOR SELECT USING ("is_public" = true);

-- Allow authenticated users to read all photos (including private ones they have access to)
CREATE POLICY "Authenticated users can view photos" ON "public"."photos"
    FOR SELECT TO authenticated USING (true);

-- Allow authenticated users to insert photos
CREATE POLICY "Authenticated users can upload photos" ON "public"."photos"
    FOR INSERT TO authenticated 
    WITH CHECK (auth.uid() = "uploaded_by");

-- Allow users to update their own uploaded photos
CREATE POLICY "Users can update their own photos" ON "public"."photos"
    FOR UPDATE TO authenticated 
    USING (auth.uid() = "uploaded_by")
    WITH CHECK (auth.uid() = "uploaded_by");

-- Allow users to delete their own uploaded photos
CREATE POLICY "Users can delete their own photos" ON "public"."photos"
    FOR DELETE TO authenticated 
    USING (auth.uid() = "uploaded_by");

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_photos_updated_at BEFORE UPDATE ON "public"."photos"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column(); 
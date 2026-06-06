-- Race Photos: image metadata for Supabase Storage-backed photo galleries

INSERT INTO "storage"."buckets" ("id", "name", "public", "file_size_limit", "allowed_mime_types")
VALUES (
    'race-photos',
    'race-photos',
    true,
    52428800,
    ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT ("id") DO UPDATE
SET
    "public" = EXCLUDED."public",
    "file_size_limit" = EXCLUDED."file_size_limit",
    "allowed_mime_types" = EXCLUDED."allowed_mime_types";

CREATE TABLE IF NOT EXISTS "public"."race_photos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "storage_bucket" "text" DEFAULT 'race-photos'::"text" NOT NULL,
    "storage_path" "text" NOT NULL,
    "year" smallint NOT NULL,
    "event_name" "text" DEFAULT 'Tahoe Relay'::"text" NOT NULL,
    "race" "text" DEFAULT 'Tahoe Relay'::"text" NOT NULL,
    "caption" "text",
    "alt_text" "text",
    "category" "text" DEFAULT 'team'::"text" NOT NULL,
    "tags" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "taken_on" date,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "featured" boolean DEFAULT false NOT NULL,
    "source" "text",
    "original_filename" "text",
    "width" integer,
    "height" integer,
    "size_bytes" integer,
    "content_type" "text",
    "uploaded_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."race_photos"
    ADD CONSTRAINT "race_photos_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."race_photos"
    ADD CONSTRAINT "race_photos_storage_object_unique" UNIQUE ("storage_bucket", "storage_path");

ALTER TABLE ONLY "public"."race_photos"
    ADD CONSTRAINT "race_photos_storage_path_check" CHECK ((length("storage_path") > 0) AND ("storage_path" !~ '^/'::"text"));

ALTER TABLE ONLY "public"."race_photos"
    ADD CONSTRAINT "race_photos_year_check" CHECK (("year" >= 1900) AND ("year" <= 2100));

ALTER TABLE ONLY "public"."race_photos"
    ADD CONSTRAINT "race_photos_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "race_photos_year_sort_order_idx"
    ON "public"."race_photos" USING "btree" ("year" DESC, "sort_order", "created_at");

CREATE INDEX IF NOT EXISTS "race_photos_category_idx"
    ON "public"."race_photos" USING "btree" ("category");

CREATE INDEX IF NOT EXISTS "race_photos_tags_idx"
    ON "public"."race_photos" USING "gin" ("tags");

CREATE OR REPLACE TRIGGER "update_race_photos_updated_at"
    BEFORE UPDATE ON "public"."race_photos"
    FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

ALTER TABLE "public"."race_photos" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read race_photos"
    ON "public"."race_photos" FOR SELECT TO "authenticated" USING (true);

CREATE POLICY "Allow authenticated users to insert race_photos"
    ON "public"."race_photos" FOR INSERT TO "authenticated" WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update race_photos"
    ON "public"."race_photos" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete race_photos"
    ON "public"."race_photos" FOR DELETE TO "authenticated" USING (true);

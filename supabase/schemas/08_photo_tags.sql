-- Photo Tags: Junction table for many-to-many relationship between photos and runners

CREATE TABLE IF NOT EXISTS "public"."photo_tags" (
    "photo_id" "uuid" NOT NULL,
    "runner_id" "uuid" NOT NULL
);

-- Primary key constraint
ALTER TABLE ONLY "public"."photo_tags"
    ADD CONSTRAINT "photo_tags_pkey" PRIMARY KEY ("photo_id", "runner_id");

-- Foreign key constraints
ALTER TABLE ONLY "public"."photo_tags"
    ADD CONSTRAINT "photo_tags_photo_id_fkey" FOREIGN KEY ("photo_id") REFERENCES "public"."photos"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."photo_tags"
    ADD CONSTRAINT "photo_tags_runner_id_fkey" FOREIGN KEY ("runner_id") REFERENCES "public"."runners"("id") ON DELETE CASCADE;

-- Indexes for better query performance
CREATE INDEX "photo_tags_photo_id_idx" ON "public"."photo_tags" ("photo_id");
CREATE INDEX "photo_tags_runner_id_idx" ON "public"."photo_tags" ("runner_id");

-- Row Level Security
ALTER TABLE "public"."photo_tags" ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read all tags
CREATE POLICY "Allow authenticated users to read photo_tags" 
    ON "public"."photo_tags" FOR SELECT TO "authenticated" USING (true);

-- Allow authenticated users to create photo_tags
CREATE POLICY "Allow authenticated users to create photo_tags"
    ON "public"."photo_tags" FOR INSERT TO "authenticated"
    WITH CHECK (true);

-- Allow users to delete their own tags or tags on their photos
CREATE POLICY "Allow users to delete their own tags or tags on their photos"
    ON "public"."photo_tags" FOR DELETE TO "authenticated"
    USING (
        "runner_id" = (SELECT "id" FROM "public"."runners" WHERE "auth_user_id" = "auth"."uid"()) OR
        "photo_id" IN (SELECT "id" FROM "public"."photos" WHERE "uploaded_by" = (SELECT "id" FROM "public"."runners" WHERE "auth_user_id" = "auth"."uid"()))
    ); 
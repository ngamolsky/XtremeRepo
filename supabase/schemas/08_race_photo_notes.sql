-- Race Photo Notes: user-authored notes attached to gallery photos

CREATE TABLE IF NOT EXISTS "public"."race_photo_notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "photo_id" "uuid" NOT NULL,
    "body" "text" NOT NULL,
    "author_id" "uuid" DEFAULT "auth"."uid"(),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."race_photo_notes"
    ADD CONSTRAINT "race_photo_notes_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."race_photo_notes"
    ADD CONSTRAINT "race_photo_notes_photo_id_fkey" FOREIGN KEY ("photo_id") REFERENCES "public"."race_photos"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."race_photo_notes"
    ADD CONSTRAINT "race_photo_notes_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."race_photo_notes"
    ADD CONSTRAINT "race_photo_notes_body_check" CHECK ((length("btrim"("body")) > 0));

CREATE INDEX IF NOT EXISTS "race_photo_notes_photo_created_at_idx"
    ON "public"."race_photo_notes" USING "btree" ("photo_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "race_photo_notes_author_id_idx"
    ON "public"."race_photo_notes" USING "btree" ("author_id");

CREATE OR REPLACE TRIGGER "update_race_photo_notes_updated_at"
    BEFORE UPDATE ON "public"."race_photo_notes"
    FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

ALTER TABLE "public"."race_photo_notes" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read race_photo_notes"
    ON "public"."race_photo_notes" FOR SELECT TO "authenticated" USING (true);

CREATE POLICY "Allow authenticated users to insert race_photo_notes"
    ON "public"."race_photo_notes" FOR INSERT TO "authenticated"
    WITH CHECK ((("author_id" IS NULL) OR ("author_id" = "auth"."uid"())));

CREATE POLICY "Allow authenticated users to update race_photo_notes"
    ON "public"."race_photo_notes" FOR UPDATE TO "authenticated"
    USING (true)
    WITH CHECK ((("author_id" IS NULL) OR ("author_id" = "auth"."uid"())));

CREATE POLICY "Allow authenticated users to delete race_photo_notes"
    ON "public"."race_photo_notes" FOR DELETE TO "authenticated" USING (true);

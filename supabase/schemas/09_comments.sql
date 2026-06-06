-- Comments: user-authored discussion attached to races, legs, run instances, and runners

CREATE TABLE IF NOT EXISTS "public"."comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "target_type" "text" NOT NULL,
    "year" smallint,
    "leg_number" smallint,
    "leg_version" smallint,
    "runner_id" "uuid",
    "body" "text" NOT NULL,
    "author_id" "uuid" DEFAULT "auth"."uid"(),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_target_type_check" CHECK (("target_type" = ANY (ARRAY['race'::"text", 'leg'::"text", 'leg_instance'::"text", 'runner'::"text"])));

ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_body_check" CHECK ((length("btrim"("body")) > 0));

ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_target_shape_check" CHECK (((("target_type" = 'race'::"text") AND ("year" IS NOT NULL) AND ("leg_number" IS NULL) AND ("leg_version" IS NULL) AND ("runner_id" IS NULL)) OR (("target_type" = 'leg'::"text") AND ("year" IS NULL) AND ("leg_number" IS NOT NULL) AND ("leg_version" IS NOT NULL) AND ("runner_id" IS NULL)) OR (("target_type" = 'leg_instance'::"text") AND ("year" IS NOT NULL) AND ("leg_number" IS NOT NULL) AND ("leg_version" IS NOT NULL) AND ("runner_id" IS NOT NULL)) OR (("target_type" = 'runner'::"text") AND ("year" IS NULL) AND ("leg_number" IS NULL) AND ("leg_version" IS NULL) AND ("runner_id" IS NOT NULL))));

ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_year_fkey" FOREIGN KEY ("year") REFERENCES "public"."placements"("year") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_leg_definitions_fkey" FOREIGN KEY ("leg_number", "leg_version") REFERENCES "public"."leg_definitions"("number", "version") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_runner_id_fkey" FOREIGN KEY ("runner_id") REFERENCES "public"."runners"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "comments_race_target_idx"
    ON "public"."comments" USING "btree" ("target_type", "year", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "comments_leg_target_idx"
    ON "public"."comments" USING "btree" ("target_type", "leg_number", "leg_version", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "comments_leg_instance_target_idx"
    ON "public"."comments" USING "btree" ("target_type", "year", "leg_number", "leg_version", "runner_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "comments_runner_target_idx"
    ON "public"."comments" USING "btree" ("target_type", "runner_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "comments_author_id_idx"
    ON "public"."comments" USING "btree" ("author_id");

CREATE OR REPLACE TRIGGER "update_comments_updated_at"
    BEFORE UPDATE ON "public"."comments"
    FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

ALTER TABLE "public"."comments" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read comments"
    ON "public"."comments" FOR SELECT TO "authenticated" USING (true);

CREATE POLICY "Allow authenticated users to insert comments"
    ON "public"."comments" FOR INSERT TO "authenticated"
    WITH CHECK ((("author_id" IS NULL) OR ("author_id" = "auth"."uid"())));

CREATE POLICY "Allow authenticated users to update own comments"
    ON "public"."comments" FOR UPDATE TO "authenticated"
    USING ((("author_id" IS NULL) OR ("author_id" = "auth"."uid"())))
    WITH CHECK ((("author_id" IS NULL) OR ("author_id" = "auth"."uid"())));

CREATE POLICY "Allow authenticated users to delete own comments"
    ON "public"."comments" FOR DELETE TO "authenticated"
    USING ((("author_id" IS NULL) OR ("author_id" = "auth"."uid"())));

CREATE OR REPLACE VIEW "public"."v_comments_with_author"
WITH ("security_invoker"='true') AS
 SELECT "c"."id",
    "c"."target_type",
    "c"."year",
    "c"."leg_number",
    "c"."leg_version",
    "c"."runner_id",
    "target_runner"."name" AS "runner_name",
    "c"."body",
    "c"."author_id",
    "author_runner"."id" AS "author_runner_id",
    "author_runner"."name" AS "author_runner_name",
    "c"."created_at",
    "c"."updated_at"
   FROM (("public"."comments" "c"
     LEFT JOIN "public"."runners" "target_runner" ON (("c"."runner_id" = "target_runner"."id")))
     LEFT JOIN "public"."runners" "author_runner" ON (("c"."author_id" = "author_runner"."auth_user_id")));

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."comments" TO "authenticated";
GRANT ALL ON TABLE "public"."comments" TO "service_role";
GRANT SELECT ON TABLE "public"."v_comments_with_author" TO "authenticated";
GRANT SELECT ON TABLE "public"."v_comments_with_author" TO "service_role";

-- Runners feature: Everything related to race participants

-- Runners table - stores information about race participants
CREATE TABLE IF NOT EXISTS "public"."runners" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text",
    "name" "text" NOT NULL,
    "auth_user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

-- Primary key and unique constraints
ALTER TABLE ONLY "public"."runners"
    ADD CONSTRAINT "runners_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."runners"
    ADD CONSTRAINT "runners_email_unique" UNIQUE ("email");

-- Foreign key to auth system
ALTER TABLE ONLY "public"."runners"
    ADD CONSTRAINT "runners_auth_user_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- Function to link runners to auth users when they sign up
CREATE OR REPLACE FUNCTION "public"."link_runner_to_auth_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    -- Try to find and update a runner with matching email
    UPDATE public.runners
    SET auth_user_id = NEW.id
    WHERE email = NEW.email
    AND auth_user_id IS NULL;
    
    RETURN NEW;
END;
$$;

-- Trigger to update updated_at on runners table
CREATE OR REPLACE TRIGGER "update_runners_updated_at" 
    BEFORE UPDATE ON "public"."runners" 
    FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

-- Trigger to link new auth users to existing runners
CREATE OR REPLACE TRIGGER "on_auth_user_created" 
    AFTER INSERT ON "auth"."users" 
    FOR EACH ROW EXECUTE FUNCTION "public"."link_runner_to_auth_user"();

-- Row Level Security
ALTER TABLE "public"."runners" ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Allow authenticated users to read runners
CREATE POLICY "Allow authenticated users to read runners" 
    ON "public"."runners" FOR SELECT TO "authenticated" USING (true); 
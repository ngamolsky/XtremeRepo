-- Create runners table
CREATE TABLE IF NOT EXISTS "public"."runners" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "email" text,
    "name" text NOT NULL,
    "auth_user_id" uuid,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Set primary key
ALTER TABLE "public"."runners" ADD CONSTRAINT "runners_pkey" PRIMARY KEY ("id");

-- Add unique constraint on email (if not null)
ALTER TABLE "public"."runners" ADD CONSTRAINT "runners_email_unique" UNIQUE ("email");

-- Add foreign key to auth.users table
ALTER TABLE "public"."runners" 
ADD CONSTRAINT "runners_auth_user_id_fkey" 
FOREIGN KEY ("auth_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

-- Add user_id column to results table (if it doesn't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'results' AND column_name = 'user_id') THEN
        ALTER TABLE "public"."results" ADD COLUMN "user_id" uuid;
    END IF;
END $$;

-- Create foreign key constraint (if it doesn't exist)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'results_user_id_fkey') THEN
        ALTER TABLE "public"."results" 
        ADD CONSTRAINT "results_user_id_fkey" 
        FOREIGN KEY ("user_id") REFERENCES "public"."runners"("id") ON DELETE SET NULL;
    END IF;
END $$;

-- Now remove the runner column entirely
ALTER TABLE "public"."results" DROP COLUMN IF EXISTS "runner";

-- Add RLS policies for runners table
ALTER TABLE "public"."runners" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read runners" ON "public"."runners" 
FOR SELECT TO "authenticated" USING (true);

-- Grant permissions
GRANT ALL ON "public"."runners" TO "authenticated";
GRANT ALL ON "public"."runners" TO "service_role";

-- Create function to automatically set updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updated_at
CREATE TRIGGER update_runners_updated_at 
    BEFORE UPDATE ON "public"."runners" 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Create function to automatically link auth users when email matches
CREATE OR REPLACE FUNCTION link_auth_user()
RETURNS TRIGGER AS $$
BEGIN
    -- If email is provided, try to link with auth.users
    IF NEW.email IS NOT NULL THEN
        SELECT id INTO NEW.auth_user_id 
        FROM auth.users 
        WHERE email = NEW.email;
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically link auth users
CREATE TRIGGER link_auth_user_trigger
    BEFORE INSERT OR UPDATE ON "public"."runners"
    FOR EACH ROW
    EXECUTE FUNCTION link_auth_user();

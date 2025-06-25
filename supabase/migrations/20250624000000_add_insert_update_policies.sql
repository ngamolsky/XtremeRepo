-- Add INSERT and UPDATE policies for placements table
CREATE POLICY "Allow authenticated users to insert placements" ON "public"."placements" 
FOR INSERT TO "authenticated" 
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update placements" ON "public"."placements" 
FOR UPDATE TO "authenticated" 
USING (true) 
WITH CHECK (true);

-- Add INSERT and UPDATE policies for results table
CREATE POLICY "Allow authenticated users to insert results" ON "public"."results" 
FOR INSERT TO "authenticated" 
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update results" ON "public"."results" 
FOR UPDATE TO "authenticated" 
USING (true) 
WITH CHECK (true);

-- Add INSERT and UPDATE policies for runners table (in case you need to create new runners)
CREATE POLICY "Allow authenticated users to insert runners" ON "public"."runners" 
FOR INSERT TO "authenticated" 
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update runners" ON "public"."runners" 
FOR UPDATE TO "authenticated" 
USING (true) 
WITH CHECK (true);

-- Add INSERT and UPDATE policies for leg_definitions table (in case you need to add new leg definitions)
CREATE POLICY "Allow authenticated users to insert leg_definitions" ON "public"."leg_definitions" 
FOR INSERT TO "authenticated" 
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update leg_definitions" ON "public"."leg_definitions" 
FOR UPDATE TO "authenticated" 
USING (true) 
WITH CHECK (true); 
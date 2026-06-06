-- Link v2 leg definitions to the official Lake Tahoe Relay course pages.

ALTER TABLE public.leg_definitions
  ADD COLUMN IF NOT EXISTS official_course_url text;

COMMENT ON COLUMN public.leg_definitions.official_course_url IS
  'Optional official course page URL for this leg definition.';

UPDATE public.leg_definitions
SET official_course_url = CASE number
  WHEN 1 THEN 'https://laketahoerelay.com/leg1/'
  WHEN 2 THEN 'https://laketahoerelay.com/leg2/'
  WHEN 3 THEN 'https://laketahoerelay.com/leg3/'
  WHEN 4 THEN 'https://laketahoerelay.com/leg4/'
  WHEN 5 THEN 'https://laketahoerelay.com/leg5/'
  WHEN 6 THEN 'https://laketahoerelay.com/leg6/'
  WHEN 7 THEN 'https://laketahoerelay.com/leg7/'
END
WHERE version = 2
  AND number BETWEEN 1 AND 7;

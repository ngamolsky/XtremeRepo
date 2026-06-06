-- Link Gabe's runner profile to his auth account.
-- The signup trigger links by email, but Gabe's runner row was seeded without one.

WITH gabe_auth AS (
  SELECT id
  FROM auth.users
  WHERE lower(email) = 'gabe@xtreme-falcons.com'
  ORDER BY created_at
  LIMIT 1
)
UPDATE public.runners r
SET email = 'gabe@xtreme-falcons.com',
    auth_user_id = COALESCE((SELECT id FROM gabe_auth), r.auth_user_id)
WHERE r.name = 'Gabe Pannell'
  AND (r.email IS NULL OR lower(r.email) = 'gabe@xtreme-falcons.com')
  AND (r.auth_user_id IS NULL OR r.auth_user_id = (SELECT id FROM gabe_auth))
  AND NOT EXISTS (
    SELECT 1
    FROM public.runners other
    WHERE other.id <> r.id
      AND lower(other.email) = 'gabe@xtreme-falcons.com'
  );

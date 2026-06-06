-- Add 2025 relay results restored from the production backup.
-- This is written as an idempotent data migration for already-deployed databases.

WITH base_data_present AS (
  SELECT EXISTS (
    SELECT 1
    FROM public.placements
    WHERE year = 2024
  ) AS ready
),
runner_values (email, name) AS (
  VALUES
    ('peter@xtreme-falcons.com', 'Peter Lubbers'),
    (NULL, 'Multiple Runners'),
    ('sean@xtreme-falcons.com', 'Sean Lubbers'),
    (NULL, 'Gabe Pannell'),
    (NULL, 'Lisa Brooks'),
    ('nick@xtreme-falcons.com', 'Nick Searle'),
    ('nikita@xtreme-falcons.com', 'Nikita Gamolsky')
)
INSERT INTO public.runners (email, name)
SELECT rv.email, rv.name
FROM runner_values rv, base_data_present bdp
WHERE bdp.ready
  AND NOT EXISTS (
  SELECT 1
  FROM public.runners r
  WHERE (rv.email IS NOT NULL AND r.email = rv.email)
     OR (rv.email IS NULL AND r.email IS NULL AND r.name = rv.name)
);

WITH base_data_present AS (
  SELECT EXISTS (
    SELECT 1
    FROM public.placements
    WHERE year = 2024
  ) AS ready
)
INSERT INTO public.placements (
  year,
  division,
  division_place,
  division_teams,
  overall_place,
  overall_teams,
  bib
)
SELECT 2025, 'Mixed Open', 20, 28, 37, 54, 37
FROM base_data_present
WHERE ready
ON CONFLICT (year) DO UPDATE
SET division = EXCLUDED.division,
    division_place = EXCLUDED.division_place,
    division_teams = EXCLUDED.division_teams,
    overall_place = EXCLUDED.overall_place,
    overall_teams = EXCLUDED.overall_teams,
    bib = EXCLUDED.bib;

WITH base_data_present AS (
  SELECT EXISTS (
    SELECT 1
    FROM public.placements
    WHERE year = 2024
  ) AS ready
),
race_results (year, leg_number, leg_version, runner_name, lap_time) AS (
  VALUES
    (2025, 1, 2, 'Peter Lubbers', INTERVAL '01:26:38'),
    (2025, 2, 2, 'Multiple Runners', INTERVAL '02:17:15'),
    (2025, 3, 2, 'Sean Lubbers', INTERVAL '01:38:38'),
    (2025, 4, 2, 'Gabe Pannell', INTERVAL '01:38:37'),
    (2025, 5, 2, 'Lisa Brooks', INTERVAL '01:57:21'),
    (2025, 6, 2, 'Nick Searle', INTERVAL '01:25:24'),
    (2025, 7, 2, 'Nikita Gamolsky', INTERVAL '01:29:48')
),
resolved_results AS (
  SELECT
    rr.year,
    rr.leg_number,
    rr.leg_version,
    rr.lap_time,
    (
      SELECT r.id
      FROM public.runners r
      WHERE r.name = rr.runner_name
      ORDER BY r.created_at
      LIMIT 1
    ) AS user_id
  FROM race_results rr
)
INSERT INTO public.results (year, leg_number, leg_version, lap_time, user_id)
SELECT year, leg_number, leg_version, lap_time, user_id
FROM resolved_results
WHERE (SELECT ready FROM base_data_present)
ON CONFLICT (year, leg_number) DO UPDATE
SET leg_version = EXCLUDED.leg_version,
    lap_time = EXCLUDED.lap_time,
    user_id = EXCLUDED.user_id;

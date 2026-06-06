-- Add a minimal 2026 race shell so self recorded race-day data has a valid year.
INSERT INTO public.placements (
  year,
  division,
  division_place,
  division_teams,
  overall_place,
  overall_teams,
  bib,
  race_start_time
)
VALUES (
  2026,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  '07:00:00'
)
ON CONFLICT (year) DO UPDATE
SET race_start_time = EXCLUDED.race_start_time;

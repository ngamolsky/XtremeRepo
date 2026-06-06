-- Correct 2016 leg 6: the runner was Vasan, not Hayes.

WITH vasan AS (
  SELECT id
  FROM public.runners
  WHERE name = 'Vasan'
)
UPDATE public.results
SET user_id = (SELECT id FROM vasan)
WHERE year = 2016
  AND leg_number = 6
  AND EXISTS (SELECT 1 FROM vasan);

INSERT INTO public.race_participations (year, runner_id, status, notes)
SELECT 2016, id, 'confirmed', NULL
FROM public.runners
WHERE name = 'Vasan'
ON CONFLICT (year, runner_id) DO UPDATE
SET status = 'confirmed',
    notes = NULL,
    updated_at = now();

DELETE FROM public.race_participations participation
USING public.runners runner
WHERE participation.year = 2016
  AND participation.runner_id = runner.id
  AND runner.name = 'Hayes'
  AND NOT EXISTS (
    SELECT 1
    FROM public.results result
    WHERE result.year = participation.year
      AND result.user_id = participation.runner_id
  );

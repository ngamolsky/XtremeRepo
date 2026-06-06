-- Fill in recovered leg assignments for years that were previously roster-only.

UPDATE public.runners
SET name = 'Jonah Nakagawa'
WHERE name = 'Jonah'
  AND NOT EXISTS (
    SELECT 1
    FROM public.runners existing_runner
    WHERE existing_runner.name = 'Jonah Nakagawa'
  );

WITH assignments (year, leg_number, runner_name) AS (
  VALUES
    (2011, 1, 'Oliver'),
    (2011, 2, 'Sean Lubbers'),
    (2011, 3, 'Rocky Lubbers'),
    (2011, 4, 'Peter Lubbers'),
    (2011, 5, 'Hayes'),
    (2011, 6, 'Sean Searle'),
    (2011, 7, 'Troy'),
    (2014, 1, 'Will Thrill Hill'),
    (2014, 2, 'Sean Lubbers'),
    (2014, 3, 'Rocky Lubbers'),
    (2014, 4, 'Peter Lubbers'),
    (2014, 5, 'Elias Denny'),
    (2014, 6, 'Abdul'),
    (2014, 7, 'Oliver'),
    (2015, 1, 'Gabe Pannell'),
    (2015, 2, 'Peter Lubbers'),
    (2015, 3, 'Sean Lubbers'),
    (2015, 4, 'Turi'),
    (2015, 5, 'Rocky Lubbers'),
    (2015, 6, 'Elias Denny'),
    (2015, 7, 'Jonah Nakagawa'),
    (2016, 1, 'Rocky Lubbers'),
    (2016, 2, 'Sean Lubbers'),
    (2016, 3, 'Peter Lubbers'),
    (2016, 4, 'Nick Searle'),
    (2016, 5, 'Turi'),
    (2016, 6, 'Hayes'),
    (2016, 7, 'Sean Searle')
)
UPDATE public.results result
SET user_id = runner.id
FROM assignments assignment
JOIN public.runners runner ON runner.name = assignment.runner_name
WHERE result.year = assignment.year
  AND result.leg_number = assignment.leg_number;

WITH assignments (year, runner_name) AS (
  VALUES
    (2011, 'Oliver'),
    (2011, 'Sean Lubbers'),
    (2011, 'Rocky Lubbers'),
    (2011, 'Peter Lubbers'),
    (2011, 'Hayes'),
    (2011, 'Sean Searle'),
    (2011, 'Troy'),
    (2014, 'Will Thrill Hill'),
    (2014, 'Sean Lubbers'),
    (2014, 'Rocky Lubbers'),
    (2014, 'Peter Lubbers'),
    (2014, 'Elias Denny'),
    (2014, 'Abdul'),
    (2014, 'Oliver'),
    (2015, 'Gabe Pannell'),
    (2015, 'Peter Lubbers'),
    (2015, 'Sean Lubbers'),
    (2015, 'Turi'),
    (2015, 'Rocky Lubbers'),
    (2015, 'Elias Denny'),
    (2015, 'Jonah Nakagawa'),
    (2016, 'Rocky Lubbers'),
    (2016, 'Sean Lubbers'),
    (2016, 'Peter Lubbers'),
    (2016, 'Nick Searle'),
    (2016, 'Turi'),
    (2016, 'Hayes'),
    (2016, 'Sean Searle')
)
INSERT INTO public.race_participations (year, runner_id, status, notes)
SELECT assignment.year, runner.id, 'confirmed', NULL
FROM assignments assignment
JOIN public.runners runner ON runner.name = assignment.runner_name
ON CONFLICT (year, runner_id) DO UPDATE
SET status = 'confirmed',
    notes = NULL,
    updated_at = now();

DELETE FROM public.race_participations participation
USING public.runners runner
WHERE participation.year = 2016
  AND participation.runner_id = runner.id
  AND runner.name = 'Vasan'
  AND NOT EXISTS (
    SELECT 1
    FROM public.results result
    WHERE result.year = participation.year
      AND result.user_id = participation.runner_id
  );

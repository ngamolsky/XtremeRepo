-- Track race-year participation independently from known leg assignments.

CREATE TABLE IF NOT EXISTS public.race_participations (
  year smallint NOT NULL,
  runner_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'confirmed',
  notes text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT race_participations_pkey PRIMARY KEY (year, runner_id),
  CONSTRAINT race_participations_status_check CHECK (status IN ('confirmed', 'tentative')),
  CONSTRAINT race_participations_year_fkey FOREIGN KEY (year) REFERENCES public.placements(year) ON DELETE CASCADE,
  CONSTRAINT race_participations_runner_id_fkey FOREIGN KEY (runner_id) REFERENCES public.runners(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS race_participations_runner_id_idx
  ON public.race_participations (runner_id);

CREATE OR REPLACE TRIGGER update_race_participations_updated_at
  BEFORE UPDATE ON public.race_participations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.ensure_result_participation() RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $$
BEGIN
  IF NEW.user_id IS NOT NULL THEN
    INSERT INTO public.race_participations (year, runner_id)
    VALUES (NEW.year, NEW.user_id)
    ON CONFLICT (year, runner_id) DO UPDATE
    SET updated_at = now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ensure_result_participation ON public.results;
CREATE TRIGGER ensure_result_participation
  AFTER INSERT OR UPDATE OF year, user_id ON public.results
  FOR EACH ROW EXECUTE FUNCTION public.ensure_result_participation();

INSERT INTO public.race_participations (year, runner_id)
SELECT DISTINCT year, user_id
FROM public.results
WHERE user_id IS NOT NULL
ON CONFLICT (year, runner_id) DO NOTHING;

ALTER TABLE public.race_participations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users to read race_participations" ON public.race_participations;
CREATE POLICY "Allow authenticated users to read race_participations"
  ON public.race_participations FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated users to insert race_participations" ON public.race_participations;
CREATE POLICY "Allow authenticated users to insert race_participations"
  ON public.race_participations FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated users to update race_participations" ON public.race_participations;
CREATE POLICY "Allow authenticated users to update race_participations"
  ON public.race_participations FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

GRANT MAINTAIN ON TABLE public.race_participations TO anon;
GRANT ALL ON TABLE public.race_participations TO authenticated;
GRANT ALL ON TABLE public.race_participations TO service_role;

CREATE OR REPLACE VIEW public.v_runner_participations AS
 SELECT rp.year,
    rp.runner_id,
    rn.name AS runner_name,
    rn.auth_user_id,
    rp.status,
    rp.notes,
    EXISTS (
      SELECT 1
      FROM public.results r
      WHERE r.year = rp.year
        AND r.user_id = rp.runner_id
    ) AS has_known_leg,
    COALESCE((
      SELECT json_agg(
        json_build_object(
          'leg_number', r.leg_number,
          'leg_version', r.leg_version,
          'lap_time', r.lap_time
        )
        ORDER BY r.leg_number
      )
      FROM public.results r
      WHERE r.year = rp.year
        AND r.user_id = rp.runner_id
    ), '[]'::json) AS known_legs
   FROM public.race_participations rp
     JOIN public.runners rn ON rp.runner_id = rn.id;

CREATE OR REPLACE VIEW public.v_runner_stats AS
 WITH result_stats AS (
         SELECT v_results_with_pace.runner_id,
            v_results_with_pace.runner_name,
            count(*) AS known_leg_runs,
            sum(v_results_with_pace.time_in_minutes) AS total_time_minutes,
            sum(v_results_with_pace.distance) AS total_distance,
            min(v_results_with_pace.pace) AS best_pace,
            avg(v_results_with_pace.pace) AS average_pace,
            min(v_results_with_pace.time_in_minutes) AS best_time,
            avg(v_results_with_pace.time_in_minutes) AS average_time,
            count(DISTINCT v_results_with_pace.leg_number) AS unique_legs
           FROM public.v_results_with_pace
          WHERE v_results_with_pace.runner_id IS NOT NULL
          GROUP BY v_results_with_pace.runner_id, v_results_with_pace.runner_name
        ), runner_participation AS (
         SELECT rp.runner_id,
            rn.name AS runner_name,
            count(*) AS total_races,
            count(DISTINCT rp.year) AS unique_years,
            json_agg(rp.year ORDER BY rp.year) AS participation_years
           FROM public.race_participations rp
             JOIN public.runners rn ON rp.runner_id = rn.id
          GROUP BY rp.runner_id, rn.name
        ), runner_paces AS (
         SELECT v_results_with_pace.runner_id,
            v_results_with_pace.runner_name,
            v_results_with_pace.pace
           FROM public.v_results_with_pace
          WHERE v_results_with_pace.pace IS NOT NULL
            AND v_results_with_pace.runner_id IS NOT NULL
        )
 SELECT p.runner_id,
    p.runner_name,
    p.total_races,
    rs.total_time_minutes,
    rs.total_distance,
    rs.best_pace,
    rs.average_pace,
    rs.best_time,
    rs.average_time,
    COALESCE(rs.unique_legs, 0::bigint) AS unique_legs,
    p.unique_years,
    ( SELECT json_agg(json_build_object('leg', best_pace_legs.leg_number, 'version', best_pace_legs.leg_version)) AS json_agg
           FROM ( SELECT DISTINCT v_results_with_pace.leg_number,
                    v_results_with_pace.leg_version
                   FROM public.v_results_with_pace
                  WHERE v_results_with_pace.runner_id = p.runner_id
                    AND v_results_with_pace.pace = ( SELECT min(runner_paces.pace) AS min
                           FROM runner_paces
                          WHERE runner_paces.runner_id = p.runner_id)) best_pace_legs) AS best_pace_legs_with_versions,
    ( SELECT json_agg(json_build_object('leg', legs_run.leg_number, 'latestVersion', legs_run.max_version)) AS json_agg
           FROM ( SELECT v_results_with_pace.leg_number,
                    max(v_results_with_pace.leg_version) AS max_version
                   FROM public.v_results_with_pace
                  WHERE v_results_with_pace.runner_id = p.runner_id
                  GROUP BY v_results_with_pace.leg_number) legs_run) AS legs_run,
    p.participation_years,
    COALESCE(rs.known_leg_runs, 0::bigint) AS known_leg_runs,
    COALESCE((
      SELECT json_agg(rp.year ORDER BY rp.year)
      FROM public.race_participations rp
      WHERE rp.runner_id = p.runner_id
        AND NOT EXISTS (
          SELECT 1
          FROM public.results r
          WHERE r.year = rp.year
            AND r.user_id = rp.runner_id
        )
    ), '[]'::json) AS unknown_leg_years
   FROM runner_participation p
     LEFT JOIN result_stats rs ON p.runner_id = rs.runner_id;

CREATE OR REPLACE VIEW public.v_yearly_summary AS
 SELECT tps.year,
    tps.total_time,
    tps.average_pace,
    tps.improvement,
    tps.overall_place,
    tps.overall_teams,
    tps.division_place,
    tps.division_teams,
    p.division,
    p.bib,
        CASE
            WHEN (tps.overall_teams > 0) THEN (((tps.overall_place)::double precision / (tps.overall_teams)::double precision) * (100)::double precision)
            ELSE NULL::double precision
        END AS overall_percentile,
        CASE
            WHEN (tps.division_teams > 0) THEN (((tps.division_place)::double precision / (tps.division_teams)::double precision) * (100)::double precision)
            ELSE NULL::double precision
        END AS division_percentile,
    p.notes,
    COALESCE(yp.participant_count, 0::bigint) AS participant_count
   FROM public.team_performance_summary tps
     LEFT JOIN public.placements p ON tps.year = p.year
     LEFT JOIN (
       SELECT race_participations.year,
          count(*) AS participant_count
       FROM public.race_participations
       GROUP BY race_participations.year
     ) yp ON tps.year = yp.year;

GRANT ALL ON TABLE public.v_runner_participations TO anon;
GRANT ALL ON TABLE public.v_runner_participations TO authenticated;
GRANT ALL ON TABLE public.v_runner_participations TO service_role;

-- Production data patch: local resets get the same data from seed.sql after migrations.
WITH runner_values (email, name) AS (
  VALUES
    (NULL, 'Abdul'),
    (NULL, 'Jonah'),
    (NULL, 'Troy'),
    (NULL, 'Vasan'),
    (NULL, 'Will Thrill Hill')
)
INSERT INTO public.runners (email, name)
SELECT rv.email, rv.name
FROM runner_values rv
WHERE EXISTS (SELECT 1 FROM public.placements WHERE year = 2011)
  AND NOT EXISTS (
    SELECT 1
    FROM public.runners r
    WHERE r.email IS NOT DISTINCT FROM rv.email
      AND r.name = rv.name
  );

UPDATE public.results
SET user_id = (SELECT id FROM public.runners WHERE name = 'Peter Lubbers' ORDER BY created_at LIMIT 1)
WHERE year = 2011
  AND leg_number = 4
  AND EXISTS (SELECT 1 FROM public.runners WHERE name = 'Peter Lubbers');

WITH recovered_participations (year, runner_name, notes) AS (
  VALUES
    (2011, 'Oliver', 'Recovered roster entry; leg assignment unknown.'),
    (2011, 'Peter Lubbers', 'Recovered roster entry; known leg 4.'),
    (2011, 'Hayes', 'Recovered roster entry; leg assignment unknown.'),
    (2011, 'Sean Lubbers', 'Recovered roster entry; leg assignment unknown.'),
    (2011, 'Rocky Lubbers', 'Recovered roster entry; leg assignment unknown.'),
    (2011, 'Troy', 'Recovered roster entry; noted as next fastest; leg assignment unknown.'),
    (2011, 'Sean Searle', 'Recovered roster entry; leg assignment unknown.'),
    (2014, 'Will Thrill Hill', 'Recovered roster entry; leg assignment unknown.'),
    (2014, 'Peter Lubbers', 'Recovered roster entry; leg assignment unknown.'),
    (2014, 'Oliver', 'Recovered roster entry; leg assignment unknown.'),
    (2014, 'Abdul', 'Recovered roster entry; leg assignment unknown.'),
    (2014, 'Sean Lubbers', 'Recovered roster entry; leg assignment unknown.'),
    (2014, 'Rocky Lubbers', 'Recovered roster entry; leg assignment unknown.'),
    (2014, 'Elias Denny', 'Recovered roster entry; leg assignment unknown.'),
    (2015, 'Elias Denny', 'Recovered roster entry; leg assignment unknown.'),
    (2015, 'Rocky Lubbers', 'Recovered roster entry; leg assignment unknown.'),
    (2015, 'Sean Lubbers', 'Recovered roster entry; leg assignment unknown.'),
    (2015, 'Peter Lubbers', 'Recovered roster entry; leg assignment unknown.'),
    (2015, 'Turi', 'Recovered roster entry; leg assignment unknown.'),
    (2015, 'Gabe Pannell', 'Recovered roster entry; leg assignment unknown.'),
    (2015, 'Jonah', 'Recovered roster entry; leg assignment unknown.'),
    (2016, 'Vasan', 'Recovered roster entry; leg assignment unknown.'),
    (2016, 'Turi', 'Recovered roster entry; leg assignment unknown.')
)
INSERT INTO public.race_participations (year, runner_id, notes)
SELECT rp.year, r.id, rp.notes
FROM recovered_participations rp
  JOIN public.runners r ON r.name = rp.runner_name
  JOIN public.placements p ON p.year = rp.year
ON CONFLICT (year, runner_id) DO UPDATE
SET notes = COALESCE(public.race_participations.notes, EXCLUDED.notes),
    updated_at = now();

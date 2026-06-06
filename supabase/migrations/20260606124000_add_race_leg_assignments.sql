-- Track planned race-day leg assignments separately from official results.
CREATE TABLE IF NOT EXISTS public.race_leg_assignments (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  year smallint NOT NULL,
  leg_number smallint NOT NULL,
  leg_version smallint NOT NULL,
  runner_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'planned',
  notes text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT race_leg_assignments_pkey PRIMARY KEY (id),
  CONSTRAINT race_leg_assignments_year_leg_key UNIQUE (year, leg_number),
  CONSTRAINT race_leg_assignments_status_check
    CHECK (status IN ('planned', 'ran', 'changed', 'scratched')),
  CONSTRAINT race_leg_assignments_year_fkey
    FOREIGN KEY (year) REFERENCES public.placements(year) ON DELETE CASCADE,
  CONSTRAINT race_leg_assignments_leg_definitions_fkey
    FOREIGN KEY (leg_number, leg_version)
    REFERENCES public.leg_definitions(number, version),
  CONSTRAINT race_leg_assignments_runner_id_fkey
    FOREIGN KEY (runner_id) REFERENCES public.runners(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS race_leg_assignments_runner_id_idx
  ON public.race_leg_assignments (runner_id);

CREATE INDEX IF NOT EXISTS race_leg_assignments_year_idx
  ON public.race_leg_assignments (year);

CREATE OR REPLACE TRIGGER update_race_leg_assignments_updated_at
  BEFORE UPDATE ON public.race_leg_assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.ensure_assignment_participation() RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $$
BEGIN
  IF NEW.status <> 'scratched' THEN
    INSERT INTO public.race_participations (year, runner_id, status)
    VALUES (NEW.year, NEW.runner_id, 'confirmed')
    ON CONFLICT (year, runner_id) DO UPDATE
    SET status = CASE
          WHEN public.race_participations.status = 'tentative' THEN 'confirmed'
          ELSE public.race_participations.status
        END,
        updated_at = now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ensure_assignment_participation ON public.race_leg_assignments;
CREATE TRIGGER ensure_assignment_participation
  AFTER INSERT OR UPDATE OF year, runner_id, status ON public.race_leg_assignments
  FOR EACH ROW EXECUTE FUNCTION public.ensure_assignment_participation();

CREATE OR REPLACE FUNCTION public.ensure_result_leg_assignment() RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $$
BEGIN
  IF NEW.user_id IS NOT NULL THEN
    INSERT INTO public.race_leg_assignments (
      year,
      leg_number,
      leg_version,
      runner_id,
      status,
      notes
    )
    VALUES (
      NEW.year,
      NEW.leg_number,
      NEW.leg_version,
      NEW.user_id,
      'ran',
      'Created from official result.'
    )
    ON CONFLICT (year, leg_number) DO UPDATE
    SET leg_version = EXCLUDED.leg_version,
        runner_id = EXCLUDED.runner_id,
        status = 'ran',
        updated_at = now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ensure_result_leg_assignment ON public.results;
CREATE TRIGGER ensure_result_leg_assignment
  AFTER INSERT OR UPDATE OF year, leg_number, leg_version, user_id ON public.results
  FOR EACH ROW EXECUTE FUNCTION public.ensure_result_leg_assignment();

INSERT INTO public.race_leg_assignments (
  year,
  leg_number,
  leg_version,
  runner_id,
  status,
  notes
)
SELECT
  r.year,
  r.leg_number,
  r.leg_version,
  r.user_id,
  'ran',
  'Backfilled from official result.'
FROM public.results r
WHERE r.user_id IS NOT NULL
ON CONFLICT (year, leg_number) DO NOTHING;

ALTER TABLE public.race_leg_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users to read race_leg_assignments"
  ON public.race_leg_assignments;
CREATE POLICY "Allow authenticated users to read race_leg_assignments"
  ON public.race_leg_assignments FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated users to insert race_leg_assignments"
  ON public.race_leg_assignments;
CREATE POLICY "Allow authenticated users to insert race_leg_assignments"
  ON public.race_leg_assignments FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated users to update race_leg_assignments"
  ON public.race_leg_assignments;
CREATE POLICY "Allow authenticated users to update race_leg_assignments"
  ON public.race_leg_assignments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated users to delete race_leg_assignments"
  ON public.race_leg_assignments;
CREATE POLICY "Allow authenticated users to delete race_leg_assignments"
  ON public.race_leg_assignments FOR DELETE TO authenticated USING (true);

GRANT MAINTAIN ON TABLE public.race_leg_assignments TO anon;
GRANT ALL ON TABLE public.race_leg_assignments TO authenticated;
GRANT ALL ON TABLE public.race_leg_assignments TO service_role;

CREATE OR REPLACE VIEW public.v_race_leg_assignments AS
 SELECT a.id,
    a.year,
    a.leg_number,
    a.leg_version,
    a.runner_id,
    rn.name AS runner_name,
    rn.auth_user_id,
    a.status,
    a.notes,
    ld.distance,
    ld.elevation_gain,
    r.lap_time AS official_lap_time,
    r.source_type AS official_source_type,
    r.canonical_observation_id,
    r.lap_time IS NOT NULL AS has_official_result,
    a.created_at,
    a.updated_at
   FROM public.race_leg_assignments a
     JOIN public.runners rn ON a.runner_id = rn.id
     JOIN public.leg_definitions ld
       ON a.leg_number = ld.number
      AND a.leg_version = ld.version
     LEFT JOIN public.results r
       ON r.year = a.year
      AND r.leg_number = a.leg_number;

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
    ) OR EXISTS (
      SELECT 1
      FROM public.race_leg_assignments a
      WHERE a.year = rp.year
        AND a.runner_id = rp.runner_id
        AND a.status <> 'scratched'
    ) AS has_known_leg,
    COALESCE((
      SELECT json_agg(
        json_build_object(
          'leg_number', known_legs.leg_number,
          'leg_version', known_legs.leg_version,
          'lap_time', known_legs.lap_time,
          'source', known_legs.source,
          'status', known_legs.status
        )
        ORDER BY known_legs.leg_number
      )
      FROM (
        SELECT
          r.leg_number,
          r.leg_version,
          r.lap_time,
          'official'::text AS source,
          'ran'::text AS status
        FROM public.results r
        WHERE r.year = rp.year
          AND r.user_id = rp.runner_id
        UNION ALL
        SELECT
          a.leg_number,
          a.leg_version,
          NULL::interval AS lap_time,
          'assignment'::text AS source,
          a.status
        FROM public.race_leg_assignments a
        WHERE a.year = rp.year
          AND a.runner_id = rp.runner_id
          AND a.status <> 'scratched'
          AND NOT EXISTS (
            SELECT 1
            FROM public.results r
            WHERE r.year = a.year
              AND r.leg_number = a.leg_number
          )
      ) known_legs
    ), '[]'::json) AS known_legs
   FROM public.race_participations rp
     JOIN public.runners rn ON rp.runner_id = rn.id;

GRANT SELECT ON TABLE public.v_race_leg_assignments TO anon, authenticated;
GRANT SELECT ON TABLE public.v_runner_participations TO anon, authenticated;
GRANT ALL ON TABLE public.v_race_leg_assignments TO service_role;
GRANT ALL ON TABLE public.v_runner_participations TO service_role;

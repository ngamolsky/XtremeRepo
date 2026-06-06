-- Track runner/device observations separately from canonical race results.

CREATE TABLE IF NOT EXISTS public.leg_result_observations (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  year smallint NOT NULL,
  leg_number smallint NOT NULL,
  leg_version smallint NOT NULL,
  runner_id uuid,
  source_type text DEFAULT 'manual_runner'::text NOT NULL,
  source_label text,
  submitted_by_runner_id uuid,
  lap_time interval,
  moving_time interval,
  elapsed_time interval,
  distance double precision,
  elevation_gain smallint,
  notes text,
  raw_metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT leg_result_observations_pkey PRIMARY KEY (id),
  CONSTRAINT leg_result_observations_source_type_check CHECK (
    source_type = ANY (
      ARRAY[
        'apple_watch'::text,
        'garmin'::text,
        'phone'::text,
        'strava'::text,
        'manual_runner'::text,
        'manual_admin'::text,
        'other'::text
      ]
    )
  ),
  CONSTRAINT leg_result_observations_distance_check CHECK (
    distance IS NULL OR distance > 0::double precision
  ),
  CONSTRAINT leg_result_observations_lap_time_check CHECK (
    lap_time IS NULL OR lap_time > '00:00:00'::interval
  ),
  CONSTRAINT leg_result_observations_moving_time_check CHECK (
    moving_time IS NULL OR moving_time > '00:00:00'::interval
  ),
  CONSTRAINT leg_result_observations_elapsed_time_check CHECK (
    elapsed_time IS NULL OR elapsed_time > '00:00:00'::interval
  ),
  CONSTRAINT leg_result_observations_raw_metadata_check CHECK (
    jsonb_typeof(raw_metadata) = 'object'::text
  ),
  CONSTRAINT leg_result_observations_leg_definitions_fkey FOREIGN KEY (leg_number, leg_version)
    REFERENCES public.leg_definitions(number, version),
  CONSTRAINT leg_result_observations_year_fkey FOREIGN KEY (year)
    REFERENCES public.placements(year) ON DELETE CASCADE,
  CONSTRAINT leg_result_observations_runner_id_fkey FOREIGN KEY (runner_id)
    REFERENCES public.runners(id) ON DELETE SET NULL,
  CONSTRAINT leg_result_observations_submitted_by_runner_id_fkey FOREIGN KEY (submitted_by_runner_id)
    REFERENCES public.runners(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS leg_result_observations_year_leg_idx
  ON public.leg_result_observations (year, leg_number, leg_version);

CREATE INDEX IF NOT EXISTS leg_result_observations_runner_id_idx
  ON public.leg_result_observations (runner_id);

CREATE INDEX IF NOT EXISTS leg_result_observations_source_type_idx
  ON public.leg_result_observations (source_type);

CREATE OR REPLACE TRIGGER update_leg_result_observations_updated_at
  BEFORE UPDATE ON public.leg_result_observations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.leg_result_observations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users to read leg_result_observations"
  ON public.leg_result_observations;
CREATE POLICY "Allow authenticated users to read leg_result_observations"
  ON public.leg_result_observations FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated users to insert leg_result_observations"
  ON public.leg_result_observations;
CREATE POLICY "Allow authenticated users to insert leg_result_observations"
  ON public.leg_result_observations FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated users to update leg_result_observations"
  ON public.leg_result_observations;
CREATE POLICY "Allow authenticated users to update leg_result_observations"
  ON public.leg_result_observations FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

GRANT MAINTAIN ON TABLE public.leg_result_observations TO anon;
GRANT ALL ON TABLE public.leg_result_observations TO authenticated;
GRANT ALL ON TABLE public.leg_result_observations TO service_role;

ALTER TABLE public.results
  ADD COLUMN IF NOT EXISTS source_type text DEFAULT 'official'::text;

UPDATE public.results
SET source_type = 'official'
WHERE source_type IS NULL;

ALTER TABLE public.results
  ALTER COLUMN source_type SET NOT NULL;

ALTER TABLE public.results
  ADD COLUMN IF NOT EXISTS canonical_observation_id uuid;

ALTER TABLE public.results
  ADD CONSTRAINT results_source_type_check CHECK (
    source_type = ANY (
      ARRAY[
        'official'::text,
        'apple_watch'::text,
        'garmin'::text,
        'phone'::text,
        'strava'::text,
        'manual_runner'::text,
        'manual_admin'::text,
        'other'::text
      ]
    )
  );

ALTER TABLE public.results
  ADD CONSTRAINT results_canonical_observation_id_fkey FOREIGN KEY (canonical_observation_id)
    REFERENCES public.leg_result_observations(id) ON DELETE SET NULL;

CREATE OR REPLACE VIEW public.v_results_with_pace AS
 SELECT r.year,
    r.user_id AS runner_id,
    r.leg_number,
    r.leg_version,
    r.lap_time,
    ld.distance,
    ld.elevation_gain,
    rn.name AS runner_name,
    rn.auth_user_id,
    public.parse_time_to_minutes(r.lap_time) AS time_in_minutes,
        CASE
            WHEN (ld.distance > (0)::double precision) THEN (public.parse_time_to_minutes(r.lap_time) / ld.distance)
            ELSE NULL::double precision
        END AS pace,
    r.notes,
    r.source_type,
    r.canonical_observation_id
   FROM ((public.results r
     JOIN public.leg_definitions ld ON (((r.leg_number = ld.number) AND (r.leg_version = ld.version))))
     LEFT JOIN public.runners rn ON ((r.user_id = rn.id)));

CREATE OR REPLACE VIEW public.v_leg_result_observations_with_pace AS
 SELECT o.id,
    o.year,
    o.runner_id,
    o.leg_number,
    o.leg_version,
    o.source_type,
    o.source_label,
    o.submitted_by_runner_id,
    submitted_by.name AS submitted_by_runner_name,
    o.lap_time,
    o.moving_time,
    o.elapsed_time,
    COALESCE(o.lap_time, o.elapsed_time, o.moving_time) AS primary_time,
        CASE
            WHEN o.lap_time IS NOT NULL THEN 'lap_time'::text
            WHEN o.elapsed_time IS NOT NULL THEN 'elapsed_time'::text
            WHEN o.moving_time IS NOT NULL THEN 'moving_time'::text
            ELSE NULL::text
        END AS primary_time_type,
    o.distance AS observed_distance,
    ld.distance AS canonical_distance,
    COALESCE(o.distance, ld.distance) AS display_distance,
    o.elevation_gain AS observed_elevation_gain,
    ld.elevation_gain AS canonical_elevation_gain,
    COALESCE(o.elevation_gain, ld.elevation_gain) AS display_elevation_gain,
    rn.name AS runner_name,
    rn.auth_user_id,
    public.parse_time_to_minutes(COALESCE(o.lap_time, o.elapsed_time, o.moving_time)) AS time_in_minutes,
        CASE
            WHEN (COALESCE(o.distance, ld.distance) > (0)::double precision)
              THEN (public.parse_time_to_minutes(COALESCE(o.lap_time, o.elapsed_time, o.moving_time)) / COALESCE(o.distance, ld.distance))
            ELSE NULL::double precision
        END AS pace,
    EXISTS (
      SELECT 1
      FROM public.results r
      WHERE r.year = o.year
        AND r.leg_number = o.leg_number
    ) AS has_canonical_result,
    canonical_result.user_id AS canonical_runner_id,
    canonical_runner.name AS canonical_runner_name,
    canonical_result.lap_time AS canonical_lap_time,
    o.notes,
    o.raw_metadata,
    o.created_at,
    o.updated_at
   FROM public.leg_result_observations o
     JOIN public.leg_definitions ld ON o.leg_number = ld.number AND o.leg_version = ld.version
     LEFT JOIN public.runners rn ON o.runner_id = rn.id
     LEFT JOIN public.runners submitted_by ON o.submitted_by_runner_id = submitted_by.id
     LEFT JOIN public.results canonical_result ON canonical_result.year = o.year AND canonical_result.leg_number = o.leg_number
     LEFT JOIN public.runners canonical_runner ON canonical_result.user_id = canonical_runner.id;

GRANT ALL ON TABLE public.v_leg_result_observations_with_pace TO anon;
GRANT ALL ON TABLE public.v_leg_result_observations_with_pace TO authenticated;
GRANT ALL ON TABLE public.v_leg_result_observations_with_pace TO service_role;

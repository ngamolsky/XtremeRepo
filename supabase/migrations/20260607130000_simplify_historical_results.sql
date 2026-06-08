-- Replace embedding/chunk search with a simple annual team-result archive.
-- Historical result ingestion is a one-off/ad hoc process: preserve raw source
-- evidence, parse team rows into historical_team_results, and manually/agent-link
-- the Xtreme/Falcons row for each year when needed.

SET search_path = public, extensions;

DROP FUNCTION IF EXISTS public.match_result_search_chunks(
  extensions.vector(1536),
  integer,
  integer,
  integer,
  integer,
  text
);
DROP FUNCTION IF EXISTS public.match_result_search_chunks(
  vector(1536),
  integer,
  integer,
  integer,
  integer,
  text
);
DROP VIEW IF EXISTS public.v_result_search;
DROP TABLE IF EXISTS public.result_search_chunks CASCADE;

-- These matching/alias tables were part of a heavier future-proofing design. The
-- app now only needs direct imported rows plus a tiny manual link table for our
-- team's row by year.
DROP TABLE IF EXISTS public.historical_runner_aliases CASCADE;
DROP TABLE IF EXISTS public.historical_team_aliases CASCADE;
DROP TABLE IF EXISTS public.historical_result_matches CASCADE;
DROP TABLE IF EXISTS public.canonical_team_results CASCADE;
DROP TABLE IF EXISTS public.canonical_leg_results CASCADE;

-- Remove operational records from the deleted embedding pipeline before tightening
-- constraints around the simpler annual import flow.
DELETE FROM public.import_warnings
WHERE entity_type = 'embedding'
   OR import_run_id IN (SELECT id FROM public.import_runs WHERE import_type = 'embed');
DELETE FROM public.import_runs
WHERE import_type = 'embed';

ALTER TABLE public.import_runs DROP CONSTRAINT IF EXISTS import_runs_import_type_check;
ALTER TABLE public.import_runs ADD CONSTRAINT import_runs_import_type_check CHECK (
  import_type = ANY (ARRAY[
    'extract'::text,
    'parse'::text,
    'normalize'::text,
    'load'::text,
    'historical_team_results_csv'::text
  ])
);

ALTER TABLE public.import_warnings DROP CONSTRAINT IF EXISTS import_warnings_entity_type_check;
ALTER TABLE public.import_warnings ADD CONSTRAINT import_warnings_entity_type_check CHECK (
  entity_type = ANY (ARRAY[
    'source'::text,
    'document'::text,
    'row'::text,
    'team'::text,
    'leg_result'::text,
    'runner_match'::text,
    'team_match'::text,
    'time_parse'::text,
    'ocr'::text
  ])
);

CREATE TABLE IF NOT EXISTS public.historical_team_results (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  source_id uuid NOT NULL,
  document_id uuid,
  raw_row_id uuid,
  import_run_id uuid,
  year smallint NOT NULL,
  race_name text DEFAULT 'Lake Tahoe Relay'::text NOT NULL,
  row_index integer,
  row_label text,
  team_name_raw text NOT NULL,
  team_name_normalized text NOT NULL,
  bib text,
  division text,
  overall_place integer,
  division_place integer,
  total_time_text text,
  total_time_seconds integer,
  raw_text text NOT NULL,
  is_our_team boolean DEFAULT false NOT NULL,
  review_status text DEFAULT 'imported'::text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
  search_vector tsvector GENERATED ALWAYS AS (
    to_tsvector(
      'english'::regconfig,
      COALESCE(team_name_raw, ''::text) || ' ' ||
      COALESCE(team_name_normalized, ''::text) || ' ' ||
      COALESCE(bib, ''::text) || ' ' ||
      COALESCE(division, ''::text) || ' ' ||
      COALESCE(raw_text, ''::text)
    )
  ) STORED,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT historical_team_results_pkey PRIMARY KEY (id),
  CONSTRAINT historical_team_results_source_id_fkey FOREIGN KEY (source_id)
    REFERENCES public.raw_result_sources(id) ON DELETE CASCADE,
  CONSTRAINT historical_team_results_document_id_fkey FOREIGN KEY (document_id)
    REFERENCES public.raw_result_documents(id) ON DELETE SET NULL,
  CONSTRAINT historical_team_results_raw_row_id_fkey FOREIGN KEY (raw_row_id)
    REFERENCES public.raw_result_rows(id) ON DELETE SET NULL,
  CONSTRAINT historical_team_results_import_run_id_fkey FOREIGN KEY (import_run_id)
    REFERENCES public.import_runs(id) ON DELETE SET NULL,
  CONSTRAINT historical_team_results_metadata_check CHECK (jsonb_typeof(metadata) = 'object'::text),
  CONSTRAINT historical_team_results_review_status_check CHECK (
    review_status = ANY (ARRAY['imported'::text, 'confirmed'::text, 'needs_review'::text, 'rejected'::text])
  ),
  CONSTRAINT historical_team_results_year_check CHECK (year BETWEEN 1900 AND 2100),
  CONSTRAINT historical_team_results_total_time_seconds_check CHECK (total_time_seconds IS NULL OR total_time_seconds >= 0),
  CONSTRAINT historical_team_results_place_check CHECK (overall_place IS NULL OR overall_place > 0),
  CONSTRAINT historical_team_results_division_place_check CHECK (division_place IS NULL OR division_place > 0)
);

CREATE INDEX IF NOT EXISTS historical_team_results_year_idx
  ON public.historical_team_results (year);
CREATE INDEX IF NOT EXISTS historical_team_results_team_name_trgm_idx
  ON public.historical_team_results USING gin (team_name_raw gin_trgm_ops);
CREATE INDEX IF NOT EXISTS historical_team_results_normalized_team_trgm_idx
  ON public.historical_team_results USING gin (team_name_normalized gin_trgm_ops);
CREATE INDEX IF NOT EXISTS historical_team_results_bib_idx
  ON public.historical_team_results (year, bib);
CREATE INDEX IF NOT EXISTS historical_team_results_division_idx
  ON public.historical_team_results (year, division);
CREATE INDEX IF NOT EXISTS historical_team_results_total_time_idx
  ON public.historical_team_results (year, total_time_seconds);
CREATE INDEX IF NOT EXISTS historical_team_results_search_idx
  ON public.historical_team_results USING gin (search_vector);
CREATE INDEX IF NOT EXISTS historical_team_results_our_team_idx
  ON public.historical_team_results (year, is_our_team)
  WHERE is_our_team;

DROP TRIGGER IF EXISTS update_historical_team_results_updated_at ON public.historical_team_results;
CREATE TRIGGER update_historical_team_results_updated_at
  BEFORE UPDATE ON public.historical_team_results
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.historical_leg_splits (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  team_result_id uuid NOT NULL,
  leg_number smallint NOT NULL,
  split_time_text text,
  split_time_seconds integer,
  runner_name text,
  metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT historical_leg_splits_pkey PRIMARY KEY (id),
  CONSTRAINT historical_leg_splits_team_result_id_fkey FOREIGN KEY (team_result_id)
    REFERENCES public.historical_team_results(id) ON DELETE CASCADE,
  CONSTRAINT historical_leg_splits_metadata_check CHECK (jsonb_typeof(metadata) = 'object'::text),
  CONSTRAINT historical_leg_splits_leg_number_check CHECK (leg_number > 0),
  CONSTRAINT historical_leg_splits_split_time_seconds_check CHECK (split_time_seconds IS NULL OR split_time_seconds >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS historical_leg_splits_team_leg_key
  ON public.historical_leg_splits (team_result_id, leg_number);

CREATE TABLE IF NOT EXISTS public.our_team_result_links (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  year smallint NOT NULL,
  historical_team_result_id uuid NOT NULL,
  canonical_team_name text DEFAULT 'Xtreme Falcons'::text NOT NULL,
  linked_by text DEFAULT 'agent_reviewed'::text NOT NULL,
  notes text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT our_team_result_links_pkey PRIMARY KEY (id),
  CONSTRAINT our_team_result_links_historical_team_result_id_fkey FOREIGN KEY (historical_team_result_id)
    REFERENCES public.historical_team_results(id) ON DELETE CASCADE,
  CONSTRAINT our_team_result_links_year_check CHECK (year BETWEEN 1900 AND 2100),
  CONSTRAINT our_team_result_links_linked_by_check CHECK (
    linked_by = ANY (ARRAY['manual'::text, 'agent_reviewed'::text, 'year_bib'::text])
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS our_team_result_links_year_key
  ON public.our_team_result_links (year);
DROP TRIGGER IF EXISTS update_our_team_result_links_updated_at ON public.our_team_result_links;
CREATE TRIGGER update_our_team_result_links_updated_at
  BEFORE UPDATE ON public.our_team_result_links
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE VIEW public.v_historical_team_results_search AS
SELECT
  result.id,
  result.source_id,
  result.document_id,
  result.raw_row_id,
  result.year,
  'team_result'::text AS chunk_type,
  result.raw_text AS chunk_text,
  result.team_name_raw AS team_name,
  NULL::text AS runner_name,
  result.bib,
  result.division,
  NULL::integer AS leg_number,
  NULL::integer AS leg_version,
  result.overall_place,
  result.division_place,
  source.source_url,
  source.local_path,
  source.original_filename,
  document.name AS document_name,
  document.document_type,
  document.page_number,
  document.sheet_index,
  result.row_index,
  result.row_label,
  result.total_time_text,
  result.total_time_seconds,
  result.is_our_team,
  link.id IS NOT NULL AS linked_to_our_team,
  link.canonical_team_name
FROM public.historical_team_results AS result
JOIN public.raw_result_sources AS source ON source.id = result.source_id
LEFT JOIN public.raw_result_documents AS document ON document.id = result.document_id
LEFT JOIN public.our_team_result_links AS link ON link.historical_team_result_id = result.id;

ALTER TABLE public.historical_team_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historical_leg_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.our_team_result_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users to read historical_team_results" ON public.historical_team_results;
CREATE POLICY "Allow authenticated users to read historical_team_results"
  ON public.historical_team_results FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Allow authenticated users to manage historical_team_results" ON public.historical_team_results;
CREATE POLICY "Allow authenticated users to manage historical_team_results"
  ON public.historical_team_results FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated users to read historical_leg_splits" ON public.historical_leg_splits;
CREATE POLICY "Allow authenticated users to read historical_leg_splits"
  ON public.historical_leg_splits FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Allow authenticated users to manage historical_leg_splits" ON public.historical_leg_splits;
CREATE POLICY "Allow authenticated users to manage historical_leg_splits"
  ON public.historical_leg_splits FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated users to read our_team_result_links" ON public.our_team_result_links;
CREATE POLICY "Allow authenticated users to read our_team_result_links"
  ON public.our_team_result_links FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Allow authenticated users to manage our_team_result_links" ON public.our_team_result_links;
CREATE POLICY "Allow authenticated users to manage our_team_result_links"
  ON public.our_team_result_links FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.historical_team_results TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.historical_leg_splits TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.our_team_result_links TO authenticated;
GRANT SELECT ON TABLE public.v_historical_team_results_search TO authenticated;
GRANT ALL ON TABLE public.historical_team_results TO service_role;
GRANT ALL ON TABLE public.historical_leg_splits TO service_role;
GRANT ALL ON TABLE public.our_team_result_links TO service_role;
GRANT SELECT ON TABLE public.v_historical_team_results_search TO service_role;

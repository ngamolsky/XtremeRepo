-- Historical Lake Tahoe Relay result ingestion and search/indexing tables.
--
-- These tables intentionally sit beside the app's canonical `placements` and
-- `results` tables. The downloaded Lake Tahoe Relay files contain many teams
-- per year and messy historical formats, so ingestion is staged as:
-- source evidence -> extracted rows/chunks -> parsed historical entities ->
-- optional reviewed promotion into canonical app data.

CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA "extensions";

CREATE TABLE IF NOT EXISTS public.raw_result_sources (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  provider text DEFAULT 'lake_tahoe_relay'::text NOT NULL,
  race_name text DEFAULT 'Lake Tahoe Relay'::text NOT NULL,
  year smallint,
  source_url text NOT NULL,
  final_url text,
  local_path text,
  original_filename text,
  file_type text NOT NULL,
  content_type text,
  bytes integer,
  sha256 text NOT NULL,
  downloaded_at timestamp with time zone,
  extraction_status text DEFAULT 'pending'::text NOT NULL,
  extraction_method text,
  metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT raw_result_sources_pkey PRIMARY KEY (id),
  CONSTRAINT raw_result_sources_file_type_check CHECK (
    file_type = ANY (ARRAY[
      'xls'::text,
      'xlsx'::text,
      'csv'::text,
      'ods'::text,
      'pdf'::text,
      'jpg'::text,
      'jpeg'::text,
      'gif'::text,
      'png'::text,
      'html'::text,
      'txt'::text,
      'unknown'::text
    ])
  ),
  CONSTRAINT raw_result_sources_extraction_status_check CHECK (
    extraction_status = ANY (ARRAY[
      'pending'::text,
      'extracted'::text,
      'partial'::text,
      'failed'::text,
      'needs_review'::text
    ])
  ),
  CONSTRAINT raw_result_sources_metadata_check CHECK (jsonb_typeof(metadata) = 'object'::text),
  CONSTRAINT raw_result_sources_bytes_check CHECK (bytes IS NULL OR bytes >= 0),
  CONSTRAINT raw_result_sources_year_check CHECK (year IS NULL OR year BETWEEN 1900 AND 2100),
  CONSTRAINT raw_result_sources_sha256_check CHECK (sha256 ~ '^[0-9a-f]{64}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS raw_result_sources_provider_source_url_key
  ON public.raw_result_sources (provider, source_url);

CREATE UNIQUE INDEX IF NOT EXISTS raw_result_sources_sha256_key
  ON public.raw_result_sources (sha256);

CREATE INDEX IF NOT EXISTS raw_result_sources_year_idx
  ON public.raw_result_sources (year);

CREATE INDEX IF NOT EXISTS raw_result_sources_extraction_status_idx
  ON public.raw_result_sources (extraction_status);

CREATE TRIGGER update_raw_result_sources_updated_at
  BEFORE UPDATE ON public.raw_result_sources
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.raw_result_documents (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  source_id uuid NOT NULL,
  document_type text NOT NULL,
  name text,
  page_number integer,
  sheet_index integer,
  row_count integer,
  column_count integer,
  extraction_status text DEFAULT 'pending'::text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT raw_result_documents_pkey PRIMARY KEY (id),
  CONSTRAINT raw_result_documents_source_id_fkey FOREIGN KEY (source_id)
    REFERENCES public.raw_result_sources(id) ON DELETE CASCADE,
  CONSTRAINT raw_result_documents_document_type_check CHECK (
    document_type = ANY (ARRAY['sheet'::text, 'pdf_page'::text, 'image'::text, 'text'::text, 'html'::text])
  ),
  CONSTRAINT raw_result_documents_extraction_status_check CHECK (
    extraction_status = ANY (ARRAY['pending'::text, 'extracted'::text, 'partial'::text, 'failed'::text, 'needs_review'::text])
  ),
  CONSTRAINT raw_result_documents_metadata_check CHECK (jsonb_typeof(metadata) = 'object'::text),
  CONSTRAINT raw_result_documents_page_number_check CHECK (page_number IS NULL OR page_number > 0),
  CONSTRAINT raw_result_documents_sheet_index_check CHECK (sheet_index IS NULL OR sheet_index >= 0),
  CONSTRAINT raw_result_documents_row_count_check CHECK (row_count IS NULL OR row_count >= 0),
  CONSTRAINT raw_result_documents_column_count_check CHECK (column_count IS NULL OR column_count >= 0)
);

CREATE INDEX IF NOT EXISTS raw_result_documents_source_id_idx
  ON public.raw_result_documents (source_id);

CREATE UNIQUE INDEX IF NOT EXISTS raw_result_documents_source_sheet_key
  ON public.raw_result_documents (source_id, sheet_index)
  WHERE sheet_index IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS raw_result_documents_source_page_key
  ON public.raw_result_documents (source_id, page_number)
  WHERE page_number IS NOT NULL;

CREATE TRIGGER update_raw_result_documents_updated_at
  BEFORE UPDATE ON public.raw_result_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.raw_result_cells (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  source_id uuid NOT NULL,
  document_id uuid,
  sheet_name text,
  row_index integer NOT NULL,
  column_index integer NOT NULL,
  cell_ref text,
  raw_value text,
  normalized_value text,
  value_type text DEFAULT 'unknown'::text NOT NULL,
  formula text,
  style_json jsonb DEFAULT '{}'::jsonb NOT NULL,
  confidence numeric,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT raw_result_cells_pkey PRIMARY KEY (id),
  CONSTRAINT raw_result_cells_source_id_fkey FOREIGN KEY (source_id)
    REFERENCES public.raw_result_sources(id) ON DELETE CASCADE,
  CONSTRAINT raw_result_cells_document_id_fkey FOREIGN KEY (document_id)
    REFERENCES public.raw_result_documents(id) ON DELETE CASCADE,
  CONSTRAINT raw_result_cells_value_type_check CHECK (
    value_type = ANY (ARRAY['text'::text, 'number'::text, 'time'::text, 'date'::text, 'blank'::text, 'formula'::text, 'unknown'::text])
  ),
  CONSTRAINT raw_result_cells_style_json_check CHECK (jsonb_typeof(style_json) = 'object'::text),
  CONSTRAINT raw_result_cells_row_index_check CHECK (row_index >= 0),
  CONSTRAINT raw_result_cells_column_index_check CHECK (column_index >= 0),
  CONSTRAINT raw_result_cells_confidence_check CHECK (confidence IS NULL OR confidence BETWEEN 0 AND 1)
);

CREATE INDEX IF NOT EXISTS raw_result_cells_source_document_row_idx
  ON public.raw_result_cells (source_id, document_id, row_index, column_index);

CREATE INDEX IF NOT EXISTS raw_result_cells_raw_value_trgm_idx
  ON public.raw_result_cells USING gin (raw_value gin_trgm_ops);

CREATE TABLE IF NOT EXISTS public.raw_result_rows (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  source_id uuid NOT NULL,
  document_id uuid,
  row_index integer,
  row_label text,
  raw_text text,
  cells jsonb DEFAULT '{}'::jsonb NOT NULL,
  parsed_json jsonb DEFAULT '{}'::jsonb NOT NULL,
  row_kind text DEFAULT 'unknown'::text NOT NULL,
  parse_status text DEFAULT 'unparsed'::text NOT NULL,
  confidence numeric,
  search_vector tsvector GENERATED ALWAYS AS (
    to_tsvector('english'::regconfig, COALESCE(raw_text, ''::text))
  ) STORED,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT raw_result_rows_pkey PRIMARY KEY (id),
  CONSTRAINT raw_result_rows_source_id_fkey FOREIGN KEY (source_id)
    REFERENCES public.raw_result_sources(id) ON DELETE CASCADE,
  CONSTRAINT raw_result_rows_document_id_fkey FOREIGN KEY (document_id)
    REFERENCES public.raw_result_documents(id) ON DELETE CASCADE,
  CONSTRAINT raw_result_rows_cells_check CHECK (jsonb_typeof(cells) = 'object'::text),
  CONSTRAINT raw_result_rows_parsed_json_check CHECK (jsonb_typeof(parsed_json) = 'object'::text),
  CONSTRAINT raw_result_rows_row_kind_check CHECK (
    row_kind = ANY (ARRAY[
      'header'::text,
      'team_summary'::text,
      'leg_result'::text,
      'division_summary'::text,
      'notes'::text,
      'ocr_block'::text,
      'unknown'::text
    ])
  ),
  CONSTRAINT raw_result_rows_parse_status_check CHECK (
    parse_status = ANY (ARRAY['unparsed'::text, 'parsed'::text, 'partial'::text, 'failed'::text, 'needs_review'::text])
  ),
  CONSTRAINT raw_result_rows_row_index_check CHECK (row_index IS NULL OR row_index >= 0),
  CONSTRAINT raw_result_rows_confidence_check CHECK (confidence IS NULL OR confidence BETWEEN 0 AND 1)
);

CREATE INDEX IF NOT EXISTS raw_result_rows_source_document_row_idx
  ON public.raw_result_rows (source_id, document_id, row_index);

CREATE INDEX IF NOT EXISTS raw_result_rows_kind_status_idx
  ON public.raw_result_rows (row_kind, parse_status);

CREATE INDEX IF NOT EXISTS raw_result_rows_search_idx
  ON public.raw_result_rows USING gin (search_vector);

CREATE INDEX IF NOT EXISTS raw_result_rows_parsed_json_idx
  ON public.raw_result_rows USING gin (parsed_json);

CREATE TRIGGER update_raw_result_rows_updated_at
  BEFORE UPDATE ON public.raw_result_rows
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.result_search_chunks (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  source_id uuid NOT NULL,
  document_id uuid,
  raw_row_id uuid,
  year smallint,
  chunk_type text DEFAULT 'row'::text NOT NULL,
  chunk_text text NOT NULL,
  structured_json jsonb DEFAULT '{}'::jsonb NOT NULL,
  team_name text,
  runner_name text,
  bib text,
  division text,
  leg_number smallint,
  leg_version smallint,
  overall_place integer,
  division_place integer,
  search_vector tsvector GENERATED ALWAYS AS (
    to_tsvector('english'::regconfig, COALESCE(chunk_text, ''::text))
  ) STORED,
  embedding extensions.vector(1536),
  embedding_model text,
  embedded_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT result_search_chunks_pkey PRIMARY KEY (id),
  CONSTRAINT result_search_chunks_source_id_fkey FOREIGN KEY (source_id)
    REFERENCES public.raw_result_sources(id) ON DELETE CASCADE,
  CONSTRAINT result_search_chunks_document_id_fkey FOREIGN KEY (document_id)
    REFERENCES public.raw_result_documents(id) ON DELETE CASCADE,
  CONSTRAINT result_search_chunks_raw_row_id_fkey FOREIGN KEY (raw_row_id)
    REFERENCES public.raw_result_rows(id) ON DELETE CASCADE,
  CONSTRAINT result_search_chunks_structured_json_check CHECK (jsonb_typeof(structured_json) = 'object'::text),
  CONSTRAINT result_search_chunks_chunk_type_check CHECK (
    chunk_type = ANY (ARRAY[
      'source_summary'::text,
      'sheet'::text,
      'page'::text,
      'row'::text,
      'team_result'::text,
      'leg_result'::text,
      'ocr_block'::text,
      'notes'::text
    ])
  ),
  CONSTRAINT result_search_chunks_year_check CHECK (year IS NULL OR year BETWEEN 1900 AND 2100),
  CONSTRAINT result_search_chunks_leg_number_check CHECK (leg_number IS NULL OR leg_number > 0),
  CONSTRAINT result_search_chunks_leg_version_check CHECK (leg_version IS NULL OR leg_version > 0)
);

CREATE INDEX IF NOT EXISTS result_search_chunks_source_id_idx
  ON public.result_search_chunks (source_id);

CREATE INDEX IF NOT EXISTS result_search_chunks_year_idx
  ON public.result_search_chunks (year);

CREATE INDEX IF NOT EXISTS result_search_chunks_team_name_idx
  ON public.result_search_chunks (team_name);

CREATE INDEX IF NOT EXISTS result_search_chunks_runner_name_idx
  ON public.result_search_chunks (runner_name);

CREATE INDEX IF NOT EXISTS result_search_chunks_leg_idx
  ON public.result_search_chunks (year, leg_number, leg_version);

CREATE INDEX IF NOT EXISTS result_search_chunks_search_idx
  ON public.result_search_chunks USING gin (search_vector);

CREATE INDEX IF NOT EXISTS result_search_chunks_structured_json_idx
  ON public.result_search_chunks USING gin (structured_json);

CREATE TRIGGER update_result_search_chunks_updated_at
  BEFORE UPDATE ON public.result_search_chunks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.historical_teams (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  year smallint NOT NULL,
  source_id uuid NOT NULL,
  raw_row_id uuid,
  bib text,
  team_name text,
  normalized_team_name text,
  division text,
  category text,
  overall_place integer,
  overall_teams integer,
  division_place integer,
  division_teams integer,
  total_time interval,
  total_time_text text,
  parse_confidence numeric,
  review_status text DEFAULT 'auto'::text NOT NULL,
  notes text,
  metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT historical_teams_pkey PRIMARY KEY (id),
  CONSTRAINT historical_teams_source_id_fkey FOREIGN KEY (source_id)
    REFERENCES public.raw_result_sources(id) ON DELETE CASCADE,
  CONSTRAINT historical_teams_raw_row_id_fkey FOREIGN KEY (raw_row_id)
    REFERENCES public.raw_result_rows(id) ON DELETE SET NULL,
  CONSTRAINT historical_teams_review_status_check CHECK (
    review_status = ANY (ARRAY['auto'::text, 'reviewed'::text, 'needs_review'::text, 'rejected'::text])
  ),
  CONSTRAINT historical_teams_metadata_check CHECK (jsonb_typeof(metadata) = 'object'::text),
  CONSTRAINT historical_teams_year_check CHECK (year BETWEEN 1900 AND 2100),
  CONSTRAINT historical_teams_parse_confidence_check CHECK (parse_confidence IS NULL OR parse_confidence BETWEEN 0 AND 1),
  CONSTRAINT historical_teams_placement_check CHECK (overall_place IS NULL OR overall_place > 0),
  CONSTRAINT historical_teams_division_place_check CHECK (division_place IS NULL OR division_place > 0)
);

CREATE INDEX IF NOT EXISTS historical_teams_year_idx
  ON public.historical_teams (year);

CREATE INDEX IF NOT EXISTS historical_teams_source_id_idx
  ON public.historical_teams (source_id);

CREATE INDEX IF NOT EXISTS historical_teams_team_name_trgm_idx
  ON public.historical_teams USING gin (team_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS historical_teams_normalized_team_name_idx
  ON public.historical_teams (normalized_team_name);

CREATE INDEX IF NOT EXISTS historical_teams_review_status_idx
  ON public.historical_teams (review_status);

CREATE UNIQUE INDEX IF NOT EXISTS historical_teams_source_bib_key
  ON public.historical_teams (source_id, bib)
  WHERE bib IS NOT NULL AND btrim(bib) <> '';

CREATE TRIGGER update_historical_teams_updated_at
  BEFORE UPDATE ON public.historical_teams
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.historical_leg_results (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  historical_team_id uuid,
  year smallint NOT NULL,
  source_id uuid NOT NULL,
  raw_row_id uuid,
  bib text,
  team_name text,
  normalized_team_name text,
  leg_number smallint,
  leg_version smallint,
  runner_name text,
  normalized_runner_name text,
  matched_runner_id uuid,
  lap_time interval,
  lap_time_text text,
  start_time time without time zone,
  finish_time time without time zone,
  pace double precision,
  distance double precision,
  elevation_gain integer,
  parse_confidence numeric,
  review_status text DEFAULT 'auto'::text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT historical_leg_results_pkey PRIMARY KEY (id),
  CONSTRAINT historical_leg_results_historical_team_id_fkey FOREIGN KEY (historical_team_id)
    REFERENCES public.historical_teams(id) ON DELETE CASCADE,
  CONSTRAINT historical_leg_results_source_id_fkey FOREIGN KEY (source_id)
    REFERENCES public.raw_result_sources(id) ON DELETE CASCADE,
  CONSTRAINT historical_leg_results_raw_row_id_fkey FOREIGN KEY (raw_row_id)
    REFERENCES public.raw_result_rows(id) ON DELETE SET NULL,
  CONSTRAINT historical_leg_results_matched_runner_id_fkey FOREIGN KEY (matched_runner_id)
    REFERENCES public.runners(id) ON DELETE SET NULL,
  CONSTRAINT historical_leg_results_review_status_check CHECK (
    review_status = ANY (ARRAY['auto'::text, 'reviewed'::text, 'needs_review'::text, 'rejected'::text])
  ),
  CONSTRAINT historical_leg_results_metadata_check CHECK (jsonb_typeof(metadata) = 'object'::text),
  CONSTRAINT historical_leg_results_year_check CHECK (year BETWEEN 1900 AND 2100),
  CONSTRAINT historical_leg_results_leg_number_check CHECK (leg_number IS NULL OR leg_number > 0),
  CONSTRAINT historical_leg_results_leg_version_check CHECK (leg_version IS NULL OR leg_version > 0),
  CONSTRAINT historical_leg_results_lap_time_check CHECK (lap_time IS NULL OR lap_time > '00:00:00'::interval),
  CONSTRAINT historical_leg_results_pace_check CHECK (pace IS NULL OR pace > 0),
  CONSTRAINT historical_leg_results_distance_check CHECK (distance IS NULL OR distance > 0),
  CONSTRAINT historical_leg_results_parse_confidence_check CHECK (parse_confidence IS NULL OR parse_confidence BETWEEN 0 AND 1)
);

CREATE INDEX IF NOT EXISTS historical_leg_results_team_id_idx
  ON public.historical_leg_results (historical_team_id);

CREATE INDEX IF NOT EXISTS historical_leg_results_source_id_idx
  ON public.historical_leg_results (source_id);

CREATE INDEX IF NOT EXISTS historical_leg_results_year_leg_idx
  ON public.historical_leg_results (year, leg_number, leg_version);

CREATE INDEX IF NOT EXISTS historical_leg_results_runner_name_trgm_idx
  ON public.historical_leg_results USING gin (runner_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS historical_leg_results_normalized_runner_name_idx
  ON public.historical_leg_results (normalized_runner_name);

CREATE INDEX IF NOT EXISTS historical_leg_results_matched_runner_id_idx
  ON public.historical_leg_results (matched_runner_id);

CREATE INDEX IF NOT EXISTS historical_leg_results_review_status_idx
  ON public.historical_leg_results (review_status);

CREATE TRIGGER update_historical_leg_results_updated_at
  BEFORE UPDATE ON public.historical_leg_results
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.historical_runner_aliases (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  raw_name text NOT NULL,
  normalized_name text NOT NULL,
  runner_id uuid,
  confidence numeric,
  match_method text DEFAULT 'unknown'::text NOT NULL,
  first_seen_year smallint,
  last_seen_year smallint,
  source_count integer DEFAULT 1 NOT NULL,
  review_status text DEFAULT 'suggested'::text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT historical_runner_aliases_pkey PRIMARY KEY (id),
  CONSTRAINT historical_runner_aliases_runner_id_fkey FOREIGN KEY (runner_id)
    REFERENCES public.runners(id) ON DELETE CASCADE,
  CONSTRAINT historical_runner_aliases_match_method_check CHECK (
    match_method = ANY (ARRAY['exact'::text, 'normalized'::text, 'manual'::text, 'semantic'::text, 'unknown'::text])
  ),
  CONSTRAINT historical_runner_aliases_review_status_check CHECK (
    review_status = ANY (ARRAY['suggested'::text, 'confirmed'::text, 'rejected'::text])
  ),
  CONSTRAINT historical_runner_aliases_metadata_check CHECK (jsonb_typeof(metadata) = 'object'::text),
  CONSTRAINT historical_runner_aliases_confidence_check CHECK (confidence IS NULL OR confidence BETWEEN 0 AND 1),
  CONSTRAINT historical_runner_aliases_source_count_check CHECK (source_count > 0),
  CONSTRAINT historical_runner_aliases_year_order_check CHECK (
    first_seen_year IS NULL OR last_seen_year IS NULL OR first_seen_year <= last_seen_year
  )
);

CREATE INDEX IF NOT EXISTS historical_runner_aliases_normalized_name_idx
  ON public.historical_runner_aliases (normalized_name);

CREATE INDEX IF NOT EXISTS historical_runner_aliases_raw_name_trgm_idx
  ON public.historical_runner_aliases USING gin (raw_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS historical_runner_aliases_runner_id_idx
  ON public.historical_runner_aliases (runner_id);

CREATE UNIQUE INDEX IF NOT EXISTS historical_runner_aliases_normalized_runner_key
  ON public.historical_runner_aliases (normalized_name, runner_id)
  WHERE runner_id IS NOT NULL;

CREATE TRIGGER update_historical_runner_aliases_updated_at
  BEFORE UPDATE ON public.historical_runner_aliases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.historical_team_aliases (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  raw_team_name text NOT NULL,
  normalized_team_name text NOT NULL,
  canonical_team_name text,
  confidence numeric,
  match_method text DEFAULT 'unknown'::text NOT NULL,
  first_seen_year smallint,
  last_seen_year smallint,
  source_count integer DEFAULT 1 NOT NULL,
  review_status text DEFAULT 'suggested'::text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT historical_team_aliases_pkey PRIMARY KEY (id),
  CONSTRAINT historical_team_aliases_match_method_check CHECK (
    match_method = ANY (ARRAY['exact'::text, 'normalized'::text, 'manual'::text, 'semantic'::text, 'unknown'::text])
  ),
  CONSTRAINT historical_team_aliases_review_status_check CHECK (
    review_status = ANY (ARRAY['suggested'::text, 'confirmed'::text, 'rejected'::text])
  ),
  CONSTRAINT historical_team_aliases_metadata_check CHECK (jsonb_typeof(metadata) = 'object'::text),
  CONSTRAINT historical_team_aliases_confidence_check CHECK (confidence IS NULL OR confidence BETWEEN 0 AND 1),
  CONSTRAINT historical_team_aliases_source_count_check CHECK (source_count > 0),
  CONSTRAINT historical_team_aliases_year_order_check CHECK (
    first_seen_year IS NULL OR last_seen_year IS NULL OR first_seen_year <= last_seen_year
  )
);

CREATE INDEX IF NOT EXISTS historical_team_aliases_normalized_team_name_idx
  ON public.historical_team_aliases (normalized_team_name);

CREATE INDEX IF NOT EXISTS historical_team_aliases_raw_team_name_trgm_idx
  ON public.historical_team_aliases USING gin (raw_team_name gin_trgm_ops);

CREATE TRIGGER update_historical_team_aliases_updated_at
  BEFORE UPDATE ON public.historical_team_aliases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.import_runs (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  source_id uuid,
  import_type text NOT NULL,
  status text DEFAULT 'running'::text NOT NULL,
  script_version text,
  git_sha text,
  started_at timestamp with time zone DEFAULT now() NOT NULL,
  finished_at timestamp with time zone,
  summary jsonb DEFAULT '{}'::jsonb NOT NULL,
  error_message text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT import_runs_pkey PRIMARY KEY (id),
  CONSTRAINT import_runs_source_id_fkey FOREIGN KEY (source_id)
    REFERENCES public.raw_result_sources(id) ON DELETE SET NULL,
  CONSTRAINT import_runs_import_type_check CHECK (
    import_type = ANY (ARRAY['extract'::text, 'parse'::text, 'normalize'::text, 'embed'::text, 'load'::text])
  ),
  CONSTRAINT import_runs_status_check CHECK (
    status = ANY (ARRAY['running'::text, 'success'::text, 'partial'::text, 'failed'::text])
  ),
  CONSTRAINT import_runs_summary_check CHECK (jsonb_typeof(summary) = 'object'::text),
  CONSTRAINT import_runs_finished_after_started_check CHECK (finished_at IS NULL OR finished_at >= started_at)
);

CREATE INDEX IF NOT EXISTS import_runs_source_id_idx
  ON public.import_runs (source_id);

CREATE INDEX IF NOT EXISTS import_runs_type_status_idx
  ON public.import_runs (import_type, status, started_at DESC);

CREATE TABLE IF NOT EXISTS public.import_warnings (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  import_run_id uuid,
  source_id uuid,
  raw_row_id uuid,
  entity_type text NOT NULL,
  severity text DEFAULT 'warning'::text NOT NULL,
  message text NOT NULL,
  details jsonb DEFAULT '{}'::jsonb NOT NULL,
  resolved_at timestamp with time zone,
  resolved_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT import_warnings_pkey PRIMARY KEY (id),
  CONSTRAINT import_warnings_import_run_id_fkey FOREIGN KEY (import_run_id)
    REFERENCES public.import_runs(id) ON DELETE CASCADE,
  CONSTRAINT import_warnings_source_id_fkey FOREIGN KEY (source_id)
    REFERENCES public.raw_result_sources(id) ON DELETE CASCADE,
  CONSTRAINT import_warnings_raw_row_id_fkey FOREIGN KEY (raw_row_id)
    REFERENCES public.raw_result_rows(id) ON DELETE SET NULL,
  CONSTRAINT import_warnings_resolved_by_fkey FOREIGN KEY (resolved_by)
    REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT import_warnings_entity_type_check CHECK (
    entity_type = ANY (ARRAY[
      'source'::text,
      'document'::text,
      'row'::text,
      'team'::text,
      'leg_result'::text,
      'runner_match'::text,
      'team_match'::text,
      'time_parse'::text,
      'ocr'::text,
      'embedding'::text
    ])
  ),
  CONSTRAINT import_warnings_severity_check CHECK (
    severity = ANY (ARRAY['info'::text, 'warning'::text, 'error'::text])
  ),
  CONSTRAINT import_warnings_details_check CHECK (jsonb_typeof(details) = 'object'::text),
  CONSTRAINT import_warnings_message_check CHECK (length(btrim(message)) > 0)
);

CREATE INDEX IF NOT EXISTS import_warnings_import_run_id_idx
  ON public.import_warnings (import_run_id);

CREATE INDEX IF NOT EXISTS import_warnings_source_id_idx
  ON public.import_warnings (source_id);

CREATE INDEX IF NOT EXISTS import_warnings_unresolved_idx
  ON public.import_warnings (severity, created_at DESC)
  WHERE resolved_at IS NULL;

CREATE OR REPLACE VIEW public.v_historical_leg_results_with_source
WITH (security_invoker = true) AS
SELECT
  hlr.id,
  hlr.historical_team_id,
  hlr.year,
  hlr.bib,
  hlr.team_name,
  hlr.normalized_team_name,
  hlr.leg_number,
  hlr.leg_version,
  hlr.runner_name,
  hlr.normalized_runner_name,
  hlr.matched_runner_id,
  matched_runner.name AS matched_runner_name,
  hlr.lap_time,
  hlr.lap_time_text,
  hlr.start_time,
  hlr.finish_time,
  hlr.pace,
  hlr.distance,
  hlr.elevation_gain,
  hlr.parse_confidence,
  hlr.review_status,
  hlr.metadata,
  hlr.source_id,
  src.source_url,
  src.local_path,
  src.original_filename,
  hlr.raw_row_id,
  raw_row.row_index,
  raw_row.raw_text,
  hlr.created_at,
  hlr.updated_at
FROM public.historical_leg_results hlr
JOIN public.raw_result_sources src ON src.id = hlr.source_id
LEFT JOIN public.raw_result_rows raw_row ON raw_row.id = hlr.raw_row_id
LEFT JOIN public.runners matched_runner ON matched_runner.id = hlr.matched_runner_id;

CREATE OR REPLACE VIEW public.v_result_search
WITH (security_invoker = true) AS
SELECT
  chunk.id,
  chunk.year,
  chunk.chunk_type,
  chunk.chunk_text,
  chunk.structured_json,
  chunk.team_name,
  chunk.runner_name,
  chunk.bib,
  chunk.division,
  chunk.leg_number,
  chunk.leg_version,
  chunk.overall_place,
  chunk.division_place,
  chunk.source_id,
  src.source_url,
  src.local_path,
  src.original_filename,
  chunk.document_id,
  doc.name AS document_name,
  doc.document_type,
  doc.page_number,
  doc.sheet_index,
  chunk.raw_row_id,
  raw_row.row_index,
  chunk.embedding_model,
  chunk.embedded_at,
  chunk.created_at,
  chunk.updated_at
FROM public.result_search_chunks chunk
JOIN public.raw_result_sources src ON src.id = chunk.source_id
LEFT JOIN public.raw_result_documents doc ON doc.id = chunk.document_id
LEFT JOIN public.raw_result_rows raw_row ON raw_row.id = chunk.raw_row_id;

ALTER TABLE public.raw_result_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raw_result_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raw_result_cells ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raw_result_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.result_search_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historical_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historical_leg_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historical_runner_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historical_team_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_warnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read raw_result_sources"
  ON public.raw_result_sources FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to manage raw_result_sources"
  ON public.raw_result_sources FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated users to read raw_result_documents"
  ON public.raw_result_documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to manage raw_result_documents"
  ON public.raw_result_documents FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated users to read raw_result_cells"
  ON public.raw_result_cells FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to manage raw_result_cells"
  ON public.raw_result_cells FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated users to read raw_result_rows"
  ON public.raw_result_rows FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to manage raw_result_rows"
  ON public.raw_result_rows FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated users to read result_search_chunks"
  ON public.result_search_chunks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to manage result_search_chunks"
  ON public.result_search_chunks FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated users to read historical_teams"
  ON public.historical_teams FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to manage historical_teams"
  ON public.historical_teams FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated users to read historical_leg_results"
  ON public.historical_leg_results FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to manage historical_leg_results"
  ON public.historical_leg_results FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated users to read historical_runner_aliases"
  ON public.historical_runner_aliases FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to manage historical_runner_aliases"
  ON public.historical_runner_aliases FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated users to read historical_team_aliases"
  ON public.historical_team_aliases FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to manage historical_team_aliases"
  ON public.historical_team_aliases FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated users to read import_runs"
  ON public.import_runs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to manage import_runs"
  ON public.import_runs FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated users to read import_warnings"
  ON public.import_warnings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to manage import_warnings"
  ON public.import_warnings FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.raw_result_sources TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.raw_result_documents TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.raw_result_cells TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.raw_result_rows TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.result_search_chunks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.historical_teams TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.historical_leg_results TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.historical_runner_aliases TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.historical_team_aliases TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.import_runs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.import_warnings TO authenticated;
GRANT SELECT ON TABLE public.v_historical_leg_results_with_source TO authenticated;
GRANT SELECT ON TABLE public.v_result_search TO authenticated;

GRANT ALL ON TABLE public.raw_result_sources TO service_role;
GRANT ALL ON TABLE public.raw_result_documents TO service_role;
GRANT ALL ON TABLE public.raw_result_cells TO service_role;
GRANT ALL ON TABLE public.raw_result_rows TO service_role;
GRANT ALL ON TABLE public.result_search_chunks TO service_role;
GRANT ALL ON TABLE public.historical_teams TO service_role;
GRANT ALL ON TABLE public.historical_leg_results TO service_role;
GRANT ALL ON TABLE public.historical_runner_aliases TO service_role;
GRANT ALL ON TABLE public.historical_team_aliases TO service_role;
GRANT ALL ON TABLE public.import_runs TO service_role;
GRANT ALL ON TABLE public.import_warnings TO service_role;
GRANT SELECT ON TABLE public.v_historical_leg_results_with_source TO service_role;
GRANT SELECT ON TABLE public.v_result_search TO service_role;

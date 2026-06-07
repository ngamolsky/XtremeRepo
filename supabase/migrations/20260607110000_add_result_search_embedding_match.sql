-- Exact pgvector search helper for historical result chunks.
--
-- This intentionally avoids an ANN index for now. The historical archive is small
-- enough for exact cosine search while we verify pgvector operator/index support in
-- the deployed Supabase environment.

DROP FUNCTION IF EXISTS public.match_result_search_chunks(
  extensions.vector(1536),
  integer,
  smallint,
  smallint,
  smallint,
  text
);

CREATE OR REPLACE FUNCTION public.match_result_search_chunks(
  query_embedding extensions.vector(1536),
  match_count integer DEFAULT 20,
  filter_year integer DEFAULT NULL,
  filter_leg_number integer DEFAULT NULL,
  filter_leg_version integer DEFAULT NULL,
  filter_chunk_type text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  source_id uuid,
  document_id uuid,
  raw_row_id uuid,
  year smallint,
  chunk_type text,
  chunk_text text,
  team_name text,
  runner_name text,
  bib text,
  division text,
  leg_number smallint,
  leg_version smallint,
  overall_place integer,
  division_place integer,
  embedding_model text,
  embedded_at timestamp with time zone,
  similarity double precision
)
LANGUAGE sql
STABLE
SET search_path = public, extensions
AS $$
  SELECT
    chunks.id,
    chunks.source_id,
    chunks.document_id,
    chunks.raw_row_id,
    chunks.year,
    chunks.chunk_type,
    chunks.chunk_text,
    chunks.team_name,
    chunks.runner_name,
    chunks.bib,
    chunks.division,
    chunks.leg_number,
    chunks.leg_version,
    chunks.overall_place,
    chunks.division_place,
    chunks.embedding_model,
    chunks.embedded_at,
    1 - (chunks.embedding <=> query_embedding) AS similarity
  FROM public.result_search_chunks AS chunks
  WHERE chunks.embedding IS NOT NULL
    AND (filter_year IS NULL OR chunks.year = filter_year)
    AND (filter_leg_number IS NULL OR chunks.leg_number = filter_leg_number)
    AND (filter_leg_version IS NULL OR chunks.leg_version = filter_leg_version)
    AND (filter_chunk_type IS NULL OR chunks.chunk_type = filter_chunk_type)
  ORDER BY chunks.embedding <=> query_embedding
  LIMIT LEAST(GREATEST(match_count, 1), 100);
$$;

COMMENT ON FUNCTION public.match_result_search_chunks(
  extensions.vector(1536),
  integer,
  integer,
  integer,
  integer,
  text
) IS 'Semantic discovery search over historical result_search_chunks embeddings; canonical result truth still comes from structured/provenance-backed rows.';

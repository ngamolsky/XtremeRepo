# Historical result indexing schema

This schema supports importing historical Lake Tahoe Relay source files without mixing messy source data directly into the app's canonical `placements` and `results` tables.

Migration: `supabase/migrations/20260607100000_add_historical_result_index.sql`

## Data layers

1. Source evidence
   - `raw_result_sources`: one row per downloaded file, with source URL, local path, type, bytes, SHA-256, and extraction status.
   - `raw_result_documents`: sheets, PDF pages, image scans, or text/html sections inside a source file.
   - `raw_result_cells`: spreadsheet/table cells with row/column coordinates and raw values.
   - `raw_result_rows`: row-level extraction with raw text, cells JSON, parser status, and full-text search vector.

2. Search layer
   - `result_search_chunks`: app/search-friendly text chunks linked back to source rows/documents/files.
   - Supports ordinary Postgres full-text search via `search_vector`.
   - Includes `embedding vector(1536)` for semantic search with pgvector once an embedding job is added. A vector ANN index can be added later once the deployed pgvector operator/index support is confirmed.
   - View: `v_result_search` joins chunks to source/document/row metadata.

3. Parsed historical entities
   - `historical_teams`: one team entry in one historical source year.
   - `historical_leg_results`: one parsed team-leg result, optionally matched to an app runner.
   - View: `v_historical_leg_results_with_source` exposes parsed leg results with source evidence.

4. Matching/review support
   - `historical_runner_aliases`: suggested/confirmed raw runner-name to canonical runner mappings.
   - `historical_team_aliases`: normalized team-name/canonical-team mappings.
   - `import_runs`: extraction/parse/normalize/embed/load job audit log.
   - `import_warnings`: review queue for parse errors, OCR issues, ambiguous matches, etc.

## Why this is separate from canonical app tables

The existing app tables are optimized for the user's team and current race views:

- `placements` is keyed by `year`.
- `results` is keyed by `(year, leg_number)`.

The historical Lake Tahoe Relay files contain many teams per year and inconsistent formats across spreadsheets, PDFs, and image scans. Historical rows should therefore be parsed into staging/indexing tables first, then reviewed/promoted into canonical app data only when confidence is high.

## Promotion path

Raw file -> extracted rows/chunks -> parsed historical teams/results -> alias matching/review -> optional promotion into canonical `results`/`placements`.

A future import script should populate these tables in order and record each step in `import_runs`/`import_warnings`.

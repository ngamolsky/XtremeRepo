# Historical result indexing schema

This schema supports a deliberately simple annual import process for historical Lake Tahoe Relay source files. The goal is not autonomous canonicalization for every possible format. The source files are preserved, then a one-off assisted parser/CSV import creates searchable team-result rows.

Migrations:

- `supabase/migrations/20260607100000_add_historical_result_index.sql` creates the original raw source evidence tables.
- `supabase/migrations/20260607130000_simplify_historical_results.sql` removes embedding/chunk search and adds the simple team-result archive.

## Data layers

1. Source evidence
   - `raw_result_sources`: one row per downloaded/uploaded file, with source URL/local path, type, bytes, SHA-256, and extraction status.
   - `raw_result_documents`: sheets, PDF pages, image scans, or text/html sections inside a source file.
   - `raw_result_cells`: spreadsheet/table cells with row/column coordinates and raw values.
   - `raw_result_rows`: row-level extraction with raw text and cells JSON.

2. Searchable team-result rows
   - `historical_team_results`: one row per team result from a source year.
   - Important fields: year, raw/normalized team name, bib, division, overall/division place, total time, raw source text, and `is_our_team` candidate flag.
   - `v_historical_team_results_search`: joins team results back to source/document metadata for the app and agent search endpoint.

3. Optional split rows
   - `historical_leg_splits`: optional per-leg split rows when a year's source includes clean split data.
   - This can be populated by a one-off script for that year's format; it is not required for team-total search.

4. Our-team link
   - `our_team_result_links`: one manual or agent-reviewed link per year from the historical source row to the Xtreme/Falcons team result.
   - This avoids pretending generic embeddings can decide team identity. For our own team, confirm the annual row using bib/year/name/source evidence.

5. Audit/review
   - `import_runs`: extraction/load job audit log.
   - `import_warnings`: review notes for parse errors, OCR issues, ambiguous rows, etc.

## Import path

Raw file -> extracted rows or cleaned CSV -> `historical_team_results` -> optional `our_team_result_links` -> app/agent search.

Use:

- `npm run results:load-extracted` for extracted JSON files.
- `npm run results:import-csv -- --file cleaned-results.csv --year YYYY` for an ad hoc cleaned annual CSV.

Embeddings are intentionally not part of this path. The database uses structured filters and boring text/trigram search over imported team-result rows.

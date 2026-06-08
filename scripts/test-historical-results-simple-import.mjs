import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
assert.equal(
  packageJson.scripts["test:historical-results-simple-import"],
  "node scripts/test-historical-results-simple-import.mjs",
  "package.json should expose focused simple import regression test"
);
assert.equal(
  packageJson.scripts["results:import-csv"],
  "node scripts/supabase/import-historical-team-results-csv.mjs",
  "package.json should expose the one-off CSV import script"
);
assert.equal(packageJson.scripts["results:embed"], undefined, "embedding generation script should be removed");
assert.equal(packageJson.scripts["results:search"], undefined, "embedding search CLI should be removed");

const migration = readFileSync("supabase/migrations/20260607130000_simplify_historical_results.sql", "utf8");
assert.match(migration, /DROP TABLE IF EXISTS public\.result_search_chunks CASCADE/, "simplification migration should drop embedding chunks");
assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.historical_team_results/, "migration should create direct team results table");
assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.our_team_result_links/, "migration should keep a tiny manual link table for our team");
assert.match(migration, /v_historical_team_results_search/, "migration should expose a simple search view");

const loader = readFileSync("scripts/supabase/load-result-extractions.mjs", "utf8");
assert.match(loader, /insertBatches\(client, "historical_team_results", teamResults\)/, "loader should load parsed rows into historical_team_results");
assert.doesNotMatch(loader, /insertBatches\(client, "result_search_chunks"/, "loader should not create embedding chunks");
assert.match(loader, /parseHistoricalTeamResultRow/, "loader should parse team rows during one-off imports");
assert.match(loader, /secondTokenIsNumeric/, "loader should parse rows that omit explicit overall place and start with bib + team");
assert.match(loader, /\(\?:x\|ex\)treme\|falcon/, "loader should flag Xtreme/Extreme/Falcons rows as our team candidates");

const csvImport = readFileSync("scripts/supabase/import-historical-team-results-csv.mjs", "utf8");
assert.match(csvImport, /historical_team_results/, "CSV importer should write direct team results");
assert.match(csvImport, /--year/, "CSV importer should require an explicit year");
assert.match(csvImport, /isOurTeamName/, "CSV importer should flag our team candidates");

const worker = readFileSync("src/worker/index.ts", "utf8");
assert.doesNotMatch(worker, /match_result_search_chunks/, "worker should not call semantic vector RPC");
assert.doesNotMatch(worker, /text-embedding-3-small/, "worker should not embed historical search queries");
assert.match(worker, /v_historical_team_results_search/, "worker search should query simple team-result search view");
assert.match(worker, /structured-text/, "worker response should report structured text search, not embedding model");

console.log("historical results simple import tests passed");

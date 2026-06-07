import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const script = read("scripts/supabase/load-result-extractions.mjs");
const packageJson = JSON.parse(read("package.json"));

assert.equal(
  packageJson.scripts["results:load-extracted"],
  "node scripts/supabase/load-result-extractions.mjs",
  "package.json should expose the extracted-result DB loader"
);
assert.match(script, /resolveSupabaseTarget\(\{ mode: args\.mode/, "loader should use the shared Supabase target resolver");
assert.match(script, /\.from\("raw_result_sources"\)[\s\S]*\.upsert\(/, "loader should upsert raw_result_sources");
assert.match(script, /onConflict: "provider,source_url"/, "loader should key sources by provider/source URL");
assert.match(script, /deleteExistingSourceExtraction/, "loader should support reload-safe replacement of extracted children");
assert.match(script, /\.from\("raw_result_documents"\)[\s\S]*\.insert/, "loader should insert raw_result_documents");
assert.match(script, /insertBatches\(client, "raw_result_cells", cells\)/, "loader should insert raw_result_cells in batches");
assert.match(script, /\.from\("raw_result_rows"\)[\s\S]*\.insert/, "loader should insert raw_result_rows");
assert.match(script, /insertBatches\(client, "result_search_chunks", chunks\)/, "loader should create result_search_chunks for search and embeddings");
assert.match(script, /sourceSummaryChunk/, "loader should create source summary chunks");
assert.match(script, /documentChunk/, "loader should create document-level chunks");
assert.match(script, /rowChunk/, "loader should create row-level chunks");
assert.match(script, /import_type: "load"/, "loader should audit DB loads in import_runs");
assert.match(script, /insertExtractionWarnings/, "loader should preserve extraction warnings in import_warnings");

console.log("result extraction loader tests passed");

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));

assert.equal(
  packageJson.scripts["results:search"],
  "node scripts/supabase/search-result-chunks.mjs",
  "package.json should expose a results:search command"
);

const cliSource = readFileSync("scripts/supabase/search-result-chunks.mjs", "utf8");

assert.match(
  cliSource,
  /readEnvFileValue[\s\S]*--env-file/,
  "semantic search CLI should support loading OPENAI_API_KEY from an explicit env file without copying it"
);
assert.match(
  cliSource,
  /https:\/\/api\.openai\.com\/v1\/embeddings/,
  "semantic search CLI should generate query embeddings with OpenAI"
);
assert.match(
  cliSource,
  /match_result_search_chunks/,
  "semantic search CLI should call the semantic match RPC"
);
assert.match(
  cliSource,
  /chunk_type|chunk-type/,
  "semantic search CLI should support chunk type filters to reduce noisy raw rows"
);
assert.match(
  cliSource,
  /source_filename|document_name|row_label/,
  "semantic search CLI output should include source evidence fields"
);

console.log("result semantic search CLI tests passed");

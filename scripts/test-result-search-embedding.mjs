import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const script = read("scripts/supabase/embed-result-search-chunks.mjs");
const migration = read("supabase/migrations/20260607110000_add_result_search_embedding_match.sql");
const packageJson = JSON.parse(read("package.json"));

assert.match(
  script,
  /DEFAULT_MODEL = "text-embedding-3-small"/,
  "embedding script should default to the 1536-dimensional OpenAI small embedding model"
);
assert.match(
  script,
  /DEFAULT_DIMENSIONS = 1536/,
  "embedding script should match result_search_chunks.embedding vector(1536)"
);
assert.match(
  script,
  /\.from\("result_search_chunks"\)[\s\S]*\.is\("embedding", null\)/,
  "embedding script should only select chunks that still need embeddings"
);
assert.match(
  script,
  /https:\/\/api\.openai\.com\/v1\/embeddings/,
  "embedding script should call the OpenAI embeddings endpoint directly"
);
assert.match(
  script,
  /\.from\("result_search_chunks"\)[\s\S]*embedding_model:[\s\S]*embedded_at:/,
  "embedding script should persist the vector, model, and embedded_at timestamp"
);
assert.match(
  script,
  /\.from\("import_runs"\)[\s\S]*import_type: "embed"/,
  "embedding script should audit each embedding run in import_runs"
);
assert.match(
  script,
  /entity_type: "embedding"[\s\S]*\.from\("import_warnings"\)\.insert/,
  "embedding script should record embedding failures in import_warnings"
);
assert.match(
  script,
  /--dry-run/,
  "embedding script should support dry-run validation"
);
assert.match(
  script,
  /--mock-embedding/,
  "embedding script should support deterministic mock embeddings for local validation"
);

assert.match(
  migration,
  /CREATE OR REPLACE FUNCTION public\.match_result_search_chunks/,
  "semantic result search RPC should exist"
);
assert.match(
  migration,
  /query_embedding extensions\.vector\(1536\)[\s\S]*filter_year integer DEFAULT NULL[\s\S]*filter_leg_number integer DEFAULT NULL[\s\S]*filter_leg_version integer DEFAULT NULL/,
  "semantic result search RPC should accept the same vector dimension as stored chunks"
);
assert.match(
  migration,
  /chunks\.embedding <=> query_embedding/,
  "semantic result search RPC should order by cosine distance"
);
assert.match(
  migration,
  /filter_year IS NULL OR chunks\.year = filter_year/,
  "semantic result search RPC should support structured year filters"
);
assert.match(
  migration,
  /LIMIT LEAST\(GREATEST\(match_count, 1\), 100\)/,
  "semantic result search RPC should clamp match_count"
);
assert.doesNotMatch(
  migration,
  /ivfflat|hnsw/i,
  "do not add a pgvector ANN index until deployed operator support is verified"
);

assert.equal(
  packageJson.scripts["results:embed"],
  "node scripts/supabase/embed-result-search-chunks.mjs",
  "package.json should expose a results:embed command"
);
assert.equal(
  packageJson.scripts["test:result-search-embedding"],
  "node scripts/test-result-search-embedding.mjs",
  "package.json should expose a focused embedding regression test"
);

console.log("result search embedding tests passed");

import { createClient } from "@supabase/supabase-js";
import { resolveSupabaseTarget } from "./target.mjs";

const DEFAULT_MODEL = "text-embedding-3-small";
const DEFAULT_DIMENSIONS = 1536;
const DEFAULT_BATCH_SIZE = 64;
const DEFAULT_LIMIT = 500;
const MAX_ATTEMPTS = 4;
const RETRY_BASE_MS = 1_000;

const args = parseArgs(process.argv.slice(2));

if (args.mockEmbedding && !args.dryRun) {
  throw new Error("--mock-embedding is validation-only; combine it with --dry-run so fake vectors are never persisted.");
}

if (!args.dryRun && !process.env.OPENAI_API_KEY) {
  throw new Error("Missing OPENAI_API_KEY. Set it, or pass --dry-run for validation only.");
}

const target = await resolveSupabaseTarget({
  mode: args.mode,
  projectRef: args.projectRef,
});
const client = createClient(target.url, target.serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
const startedAt = new Date().toISOString();
const gitSha = await readGitSha();
let importRunId = null;

try {
  if (!args.dryRun) {
    importRunId = await createImportRun(client, {
      model: args.model,
      dimensions: args.dimensions,
      batchSize: args.batchSize,
      limit: args.limit,
      dryRun: args.dryRun,
      mockEmbedding: args.mockEmbedding,
      gitSha,
    });
  }

  const chunks = await loadPendingChunks(client, args);
  const summary = {
    selected: chunks.length,
    embedded: 0,
    skipped: 0,
    failed: 0,
    model: args.model,
    dimensions: args.dimensions,
    dryRun: args.dryRun,
    mockEmbedding: args.mockEmbedding,
  };

  if (chunks.length === 0) {
    if (importRunId) {
      await finishImportRun(client, importRunId, "success", summary);
    }
    console.log(`No result_search_chunks rows need embedding in ${target.mode} (${target.projectRef}).`);
    process.exit(0);
  }

  console.log(
    `${args.dryRun ? "Dry run: would embed" : "Embedding"} ${chunks.length} result_search_chunks row(s) in ${target.mode} (${target.projectRef}) with ${args.model}.`
  );

  for (let offset = 0; offset < chunks.length; offset += args.batchSize) {
    const batch = chunks.slice(offset, offset + args.batchSize);
    const labels = batch.map((chunk) => describeChunk(chunk)).join(", ");

    if (args.dryRun && !args.mockEmbedding) {
      summary.skipped += batch.length;
      console.log(`[${offset + 1}-${offset + batch.length}/${chunks.length}] ${labels}`);
      continue;
    }

    try {
      const embeddings = args.mockEmbedding
        ? batch.map((chunk) => mockEmbedding(chunk.chunk_text, args.dimensions))
        : await embedTexts(batch.map((chunk) => chunk.chunk_text), args);

      if (embeddings.length !== batch.length) {
        throw new Error(`Embedding response returned ${embeddings.length} item(s) for ${batch.length} input(s).`);
      }

      for (let index = 0; index < batch.length; index += 1) {
        const chunk = batch[index];
        const embedding = embeddings[index];

        validateEmbedding(embedding, args.dimensions, chunk.id);

        if (!args.dryRun) {
          await updateChunkEmbedding(client, chunk.id, embedding, args.model);
        }

        summary.embedded += 1;
      }

      console.log(`[${Math.min(offset + batch.length, chunks.length)}/${chunks.length}] embedded ${batch.length}: ${labels}`);
    } catch (error) {
      summary.failed += batch.length;
      if (!args.dryRun) {
        await writeEmbeddingWarning(client, {
          importRunId,
          chunks: batch,
          message: error.message,
        });
      }
      console.warn(`Failed embedding batch ${offset + 1}-${offset + batch.length}: ${error.message}`);
    }
  }

  const status = summary.failed > 0 ? (summary.embedded > 0 ? "partial" : "failed") : "success";
  if (importRunId) {
    await finishImportRun(client, importRunId, status, summary);
  }

  if (status === "failed") {
    process.exitCode = 1;
  }

  console.log(
    `Embedding run ${status}: embedded=${summary.embedded}, skipped=${summary.skipped}, failed=${summary.failed}.`
  );
} catch (error) {
  if (importRunId) {
    await finishImportRun(client, importRunId, "failed", { error: error.message }, error.message);
  }
  throw error;
}

function parseArgs(argv) {
  const parsed = {
    mode: "local",
    projectRef: "",
    model: process.env.RESULT_EMBEDDING_MODEL || DEFAULT_MODEL,
    dimensions: parsePositiveInteger(process.env.RESULT_EMBEDDING_DIMENSIONS, DEFAULT_DIMENSIONS),
    batchSize: parsePositiveInteger(process.env.RESULT_EMBEDDING_BATCH_SIZE, DEFAULT_BATCH_SIZE),
    limit: parsePositiveInteger(process.env.RESULT_EMBEDDING_LIMIT, DEFAULT_LIMIT),
    dryRun: false,
    mockEmbedding: false,
    year: null,
    sourceId: null,
    chunkType: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--local") {
      parsed.mode = "local";
    } else if (arg === "--prod") {
      parsed.mode = "prod";
    } else if (arg === "--custom") {
      parsed.mode = "custom";
    } else if (arg === "--dry-run") {
      parsed.dryRun = true;
    } else if (arg === "--mock-embedding") {
      parsed.mockEmbedding = true;
    } else if (arg === "--project-ref") {
      parsed.projectRef = argv[++index] || "";
    } else if (arg.startsWith("--project-ref=")) {
      parsed.projectRef = arg.slice("--project-ref=".length);
    } else if (arg === "--model") {
      parsed.model = argv[++index] || parsed.model;
    } else if (arg.startsWith("--model=")) {
      parsed.model = arg.slice("--model=".length);
    } else if (arg === "--dimensions") {
      parsed.dimensions = parsePositiveInteger(argv[++index], DEFAULT_DIMENSIONS);
    } else if (arg.startsWith("--dimensions=")) {
      parsed.dimensions = parsePositiveInteger(arg.slice("--dimensions=".length), DEFAULT_DIMENSIONS);
    } else if (arg === "--batch-size") {
      parsed.batchSize = parsePositiveInteger(argv[++index], DEFAULT_BATCH_SIZE);
    } else if (arg.startsWith("--batch-size=")) {
      parsed.batchSize = parsePositiveInteger(arg.slice("--batch-size=".length), DEFAULT_BATCH_SIZE);
    } else if (arg === "--limit") {
      parsed.limit = parsePositiveInteger(argv[++index], DEFAULT_LIMIT);
    } else if (arg.startsWith("--limit=")) {
      parsed.limit = parsePositiveInteger(arg.slice("--limit=".length), DEFAULT_LIMIT);
    } else if (arg === "--year") {
      parsed.year = parsePositiveInteger(argv[++index], null);
    } else if (arg.startsWith("--year=")) {
      parsed.year = parsePositiveInteger(arg.slice("--year=".length), null);
    } else if (arg === "--source-id") {
      parsed.sourceId = argv[++index] || null;
    } else if (arg.startsWith("--source-id=")) {
      parsed.sourceId = arg.slice("--source-id=".length) || null;
    } else if (arg === "--chunk-type") {
      parsed.chunkType = argv[++index] || null;
    } else if (arg.startsWith("--chunk-type=")) {
      parsed.chunkType = arg.slice("--chunk-type=".length) || null;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (parsed.dimensions !== DEFAULT_DIMENSIONS) {
    throw new Error(
      `result_search_chunks.embedding is vector(${DEFAULT_DIMENSIONS}); use --dimensions ${DEFAULT_DIMENSIONS} or add a matching migration first.`
    );
  }

  return parsed;
}

async function loadPendingChunks(client, args) {
  let query = client
    .from("result_search_chunks")
    .select("id, source_id, raw_row_id, year, chunk_type, chunk_text, team_name, runner_name, leg_number, leg_version")
    .is("embedding", null)
    .order("year", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true })
    .limit(args.limit);

  if (args.year) {
    query = query.eq("year", args.year);
  }
  if (args.sourceId) {
    query = query.eq("source_id", args.sourceId);
  }
  if (args.chunkType) {
    query = query.eq("chunk_type", args.chunkType);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Could not load pending chunks: ${error.message}`);
  }

  return data || [];
}

async function embedTexts(texts, args) {
  const response = await withRetry(async () => {
    const result = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: args.model,
        input: texts,
        dimensions: args.dimensions,
      }),
    });

    const body = await result.json().catch(() => ({}));

    if (!result.ok) {
      const message = body.error?.message || `${result.status} ${result.statusText}`;
      throw new Error(`OpenAI embeddings request failed: ${message}`);
    }

    return body;
  }, "calling OpenAI embeddings");

  return [...response.data]
    .sort((a, b) => a.index - b.index)
    .map((item) => item.embedding);
}

async function updateChunkEmbedding(client, id, embedding, model) {
  const { error } = await client
    .from("result_search_chunks")
    .update({
      embedding,
      embedding_model: model,
      embedded_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    throw new Error(`Could not update embedding for chunk ${id}: ${error.message}`);
  }
}

async function createImportRun(client, summary) {
  const { data, error } = await client
    .from("import_runs")
    .insert({
      import_type: "embed",
      status: "running",
      script_version: "scripts/supabase/embed-result-search-chunks.mjs",
      git_sha: summary.gitSha,
      summary,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Could not create import_runs row: ${error.message}`);
  }

  return data.id;
}

async function finishImportRun(client, id, status, summary, errorMessage = null) {
  const { error } = await client
    .from("import_runs")
    .update({
      status,
      finished_at: new Date().toISOString(),
      summary: {
        ...summary,
        started_at: startedAt,
        finished_at: new Date().toISOString(),
      },
      error_message: errorMessage,
    })
    .eq("id", id);

  if (error) {
    throw new Error(`Could not finish import_runs row ${id}: ${error.message}`);
  }
}

async function writeEmbeddingWarning(client, { importRunId, chunks, message }) {
  const rows = chunks.map((chunk) => ({
    import_run_id: importRunId,
    source_id: chunk.source_id,
    raw_row_id: chunk.raw_row_id,
    entity_type: "embedding",
    severity: "error",
    message,
    details: {
      chunk_id: chunk.id,
      year: chunk.year,
      chunk_type: chunk.chunk_type,
    },
  }));
  const { error } = await client.from("import_warnings").insert(rows);

  if (error) {
    console.warn(`Could not write embedding warning(s): ${error.message}`);
  }
}

async function withRetry(operation, label) {
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt === MAX_ATTEMPTS) {
        break;
      }

      const delayMs = RETRY_BASE_MS * 2 ** (attempt - 1);
      console.warn(`Retrying ${label} after ${error.message} (${attempt}/${MAX_ATTEMPTS - 1})`);
      await sleep(delayMs);
    }
  }

  throw lastError;
}

function mockEmbedding(text, dimensions) {
  let seed = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    seed ^= text.charCodeAt(index);
    seed = Math.imul(seed, 16777619);
  }

  const vector = [];
  let state = seed >>> 0;
  for (let index = 0; index < dimensions; index += 1) {
    state = Math.imul(state ^ (state >>> 15), 2246822507) >>> 0;
    vector.push((state / 0xffffffff) * 2 - 1);
  }
  return normalize(vector);
}

function normalize(vector) {
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  return vector.map((value) => value / magnitude);
}

function validateEmbedding(embedding, dimensions, id) {
  if (!Array.isArray(embedding) || embedding.length !== dimensions) {
    throw new Error(`Chunk ${id} embedding has ${Array.isArray(embedding) ? embedding.length : "non-array"} dimensions; expected ${dimensions}.`);
  }
  if (!embedding.every((value) => Number.isFinite(value))) {
    throw new Error(`Chunk ${id} embedding contains a non-finite value.`);
  }
}

function describeChunk(chunk) {
  return [chunk.year, chunk.chunk_type, chunk.team_name, chunk.runner_name, chunk.leg_number && `leg ${chunk.leg_number}v${chunk.leg_version || "?"}`]
    .filter(Boolean)
    .join("/") || chunk.id;
}

function parsePositiveInteger(value, fallback) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Expected a positive integer, got ${value}`);
  }
  return parsed;
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function readGitSha() {
  try {
    const { execFileSync } = await import("node:child_process");
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

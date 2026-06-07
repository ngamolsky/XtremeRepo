import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolveSupabaseTarget } from "./target.mjs";

const DEFAULT_MODEL = "text-embedding-3-small";
const DEFAULT_DIMENSIONS = 1536;
const DEFAULT_MATCH_COUNT = 10;

const args = parseArgs(process.argv.slice(2));
const openAIKey = process.env.OPENAI_API_KEY || readEnvFileValue(args.envFile, "OPENAI_API_KEY");

if (!openAIKey) {
  throw new Error("Missing OPENAI_API_KEY. Set it in the environment or pass --env-file <path>.");
}

const target = await resolveSupabaseTarget({ mode: args.mode, projectRef: args.projectRef });
const client = createClient(target.url, target.serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const queryEmbedding = await embedQuery(args.query, {
  apiKey: openAIKey,
  model: args.model,
  dimensions: args.dimensions,
});
const matches = await semanticSearch(client, queryEmbedding, args);
const enriched = await enrichMatches(client, matches);

printResults(enriched, args);

function parseArgs(argv) {
  const parsed = {
    mode: "local",
    projectRef: "",
    query: "",
    envFile: "",
    model: process.env.RESULT_EMBEDDING_MODEL || DEFAULT_MODEL,
    dimensions: parsePositiveInteger(process.env.RESULT_EMBEDDING_DIMENSIONS, DEFAULT_DIMENSIONS),
    matchCount: DEFAULT_MATCH_COUNT,
    year: null,
    legNumber: null,
    legVersion: null,
    chunkType: "",
    json: false,
  };

  const queryParts = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--local") {
      parsed.mode = "local";
    } else if (arg === "--prod") {
      parsed.mode = "prod";
    } else if (arg === "--custom") {
      parsed.mode = "custom";
    } else if (arg === "--project-ref") {
      parsed.projectRef = argv[++index] || "";
    } else if (arg.startsWith("--project-ref=")) {
      parsed.projectRef = arg.slice("--project-ref=".length);
    } else if (arg === "--env-file") {
      parsed.envFile = argv[++index] || "";
    } else if (arg.startsWith("--env-file=")) {
      parsed.envFile = arg.slice("--env-file=".length);
    } else if (arg === "--model") {
      parsed.model = argv[++index] || parsed.model;
    } else if (arg.startsWith("--model=")) {
      parsed.model = arg.slice("--model=".length);
    } else if (arg === "--dimensions") {
      parsed.dimensions = parsePositiveInteger(argv[++index], DEFAULT_DIMENSIONS);
    } else if (arg.startsWith("--dimensions=")) {
      parsed.dimensions = parsePositiveInteger(arg.slice("--dimensions=".length), DEFAULT_DIMENSIONS);
    } else if (arg === "--limit" || arg === "--match-count") {
      parsed.matchCount = parsePositiveInteger(argv[++index], DEFAULT_MATCH_COUNT);
    } else if (arg.startsWith("--limit=")) {
      parsed.matchCount = parsePositiveInteger(arg.slice("--limit=".length), DEFAULT_MATCH_COUNT);
    } else if (arg.startsWith("--match-count=")) {
      parsed.matchCount = parsePositiveInteger(arg.slice("--match-count=".length), DEFAULT_MATCH_COUNT);
    } else if (arg === "--year") {
      parsed.year = parsePositiveInteger(argv[++index], null);
    } else if (arg.startsWith("--year=")) {
      parsed.year = parsePositiveInteger(arg.slice("--year=".length), null);
    } else if (arg === "--leg-number") {
      parsed.legNumber = parsePositiveInteger(argv[++index], null);
    } else if (arg.startsWith("--leg-number=")) {
      parsed.legNumber = parsePositiveInteger(arg.slice("--leg-number=".length), null);
    } else if (arg === "--leg-version") {
      parsed.legVersion = parsePositiveInteger(argv[++index], null);
    } else if (arg.startsWith("--leg-version=")) {
      parsed.legVersion = parsePositiveInteger(arg.slice("--leg-version=".length), null);
    } else if (arg === "--chunk-type") {
      parsed.chunkType = argv[++index] || "";
    } else if (arg.startsWith("--chunk-type=")) {
      parsed.chunkType = arg.slice("--chunk-type=".length);
    } else if (arg === "--json") {
      parsed.json = true;
    } else if (arg.startsWith("--")) {
      throw new Error(`Unknown argument: ${arg}`);
    } else {
      queryParts.push(arg);
    }
  }

  parsed.query = queryParts.join(" ").trim();
  if (!parsed.query) {
    throw new Error("Usage: npm run results:search -- [--local|--prod] [--env-file path] [--year 2025] [--chunk-type team_result] \"query text\"");
  }

  if (parsed.dimensions !== DEFAULT_DIMENSIONS) {
    throw new Error(`result_search_chunks.embedding is vector(${DEFAULT_DIMENSIONS}); use --dimensions ${DEFAULT_DIMENSIONS}.`);
  }

  return parsed;
}

function readEnvFileValue(envFile, keyName) {
  if (!envFile) {
    return "";
  }

  const content = readFileSync(envFile, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) {
      continue;
    }

    const [name, ...valueParts] = line.split("=");
    if (name.trim() !== keyName) {
      continue;
    }

    return valueParts.join("=").trim().replace(/^['"]|['"]$/g, "");
  }

  return "";
}

async function embedQuery(query, { apiKey, model, dimensions }) {
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: query,
      dimensions,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI query embedding failed ${response.status}: ${await response.text()}`);
  }

  const body = await response.json();
  const embedding = body?.data?.[0]?.embedding;
  if (!Array.isArray(embedding) || embedding.length !== dimensions) {
    throw new Error(`OpenAI returned an invalid query embedding shape.`);
  }
  return embedding;
}

async function semanticSearch(client, queryEmbedding, args) {
  const { data, error } = await client.rpc("match_result_search_chunks", {
    query_embedding: queryEmbedding,
    match_count: args.matchCount,
    filter_year: args.year,
    filter_leg_number: args.legNumber,
    filter_leg_version: args.legVersion,
    filter_chunk_type: args.chunkType || null,
  });

  if (error) {
    throw error;
  }

  return data || [];
}

async function enrichMatches(client, matches) {
  if (matches.length === 0) {
    return [];
  }

  const ids = matches.map((match) => match.id);
  const { data, error } = await client
    .from("v_result_search")
    .select("id, source_url, local_path, original_filename, document_name, document_type, page_number, sheet_index, row_index")
    .in("id", ids);

  if (error) {
    throw error;
  }

  const evidenceById = new Map((data || []).map((row) => [row.id, row]));
  return matches.map((match) => ({
    ...match,
    ...(evidenceById.get(match.id) || {}),
    source_filename: evidenceById.get(match.id)?.original_filename || evidenceById.get(match.id)?.local_path || "",
    row_label: evidenceById.get(match.id)?.row_index == null ? "" : String(evidenceById.get(match.id).row_index + 1),
  }));
}

function printResults(results, args) {
  if (args.json) {
    console.log(JSON.stringify({ query: args.query, results }, null, 2));
    return;
  }

  console.log(`Semantic historical result search: ${args.query}`);
  if (args.year) {
    console.log(`year filter: ${args.year}`);
  }
  if (args.chunkType) {
    console.log(`chunk type filter: ${args.chunkType}`);
  }

  if (results.length === 0) {
    console.log("No matches.");
    return;
  }

  for (const [index, result] of results.entries()) {
    const source = [
      result.source_filename,
      result.document_name,
      result.row_label ? `row ${result.row_label}` : "",
    ]
      .filter(Boolean)
      .join(" · ");
    const text = String(result.chunk_text || "").replace(/\s+/g, " ").trim();

    console.log(`\n${index + 1}. ${(Number(result.similarity) || 0).toFixed(4)} · ${result.year ?? "unknown"} · ${result.chunk_type}`);
    if (source) {
      console.log(`   source: ${source}`);
    }
    if (result.team_name || result.runner_name || result.leg_number) {
      console.log(
        `   fields: ${[
          result.team_name ? `team=${result.team_name}` : "",
          result.runner_name ? `runner=${result.runner_name}` : "",
          result.leg_number ? `leg=${result.leg_number}v${result.leg_version || 1}` : "",
        ]
          .filter(Boolean)
          .join(" · ")}`
      );
    }
    console.log(`   ${text.slice(0, 320)}${text.length > 320 ? "…" : ""}`);
  }
}

function parsePositiveInteger(value, fallback) {
  if (value == null || value === "") {
    return fallback;
  }

  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

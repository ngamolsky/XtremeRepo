import { readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { resolveSupabaseTarget } from "./target.mjs";

const args = parseArgs(process.argv.slice(2));
if (!args.file) {
  throw new Error("Usage: npm run results:import-csv -- --file results.csv --year 2024 [--prod]");
}
if (!args.year) {
  throw new Error("Pass --year YYYY so the one-off import is explicit.");
}

const target = await resolveSupabaseTarget({ mode: args.mode, projectRef: args.projectRef });
const client = createClient(target.url, target.serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const rows = parseCsv(readFileSync(args.file, "utf8"));
if (rows.length === 0) {
  throw new Error(`No data rows found in ${args.file}.`);
}

const importRunId = await createImportRun(client, args, rows.length);
const sourceId = await upsertCsvSource(client, args, rows.length);
if (args.reload) {
  await checkedDelete(client.from("historical_team_results").delete().eq("source_id", sourceId), "historical_team_results");
}

const payload = rows.map((row, index) => buildTeamResultRow(row, index, sourceId, importRunId, args));
await insertBatches(client, "historical_team_results", payload);
await finishImportRun(client, importRunId, "success", { rows: payload.length, file: args.file, year: args.year });
console.log(`Imported ${payload.length} historical team result row(s) for ${args.year} into ${target.mode} (${target.projectRef}).`);

function parseArgs(argv) {
  const parsed = { mode: "local", projectRef: "", file: "", year: null, reload: true };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--local") parsed.mode = "local";
    else if (arg === "--prod") parsed.mode = "prod";
    else if (arg === "--custom") parsed.mode = "custom";
    else if (arg === "--project-ref") parsed.projectRef = argv[++index] || "";
    else if (arg.startsWith("--project-ref=")) parsed.projectRef = arg.slice("--project-ref=".length);
    else if (arg === "--file") parsed.file = argv[++index] || "";
    else if (arg.startsWith("--file=")) parsed.file = arg.slice("--file=".length);
    else if (arg === "--year") parsed.year = parseYear(argv[++index]);
    else if (arg.startsWith("--year=")) parsed.year = parseYear(arg.slice("--year=".length));
    else if (arg === "--no-reload") parsed.reload = false;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function parseCsv(text) {
  const records = [];
  let field = "";
  let record = [];
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (quoted && char === '"' && next === '"') {
      field += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (!quoted && char === ",") {
      record.push(field);
      field = "";
    } else if (!quoted && (char === "\n" || char === "\r")) {
      if (char === "\r" && next === "\n") index += 1;
      record.push(field);
      if (record.some((value) => value.trim())) records.push(record);
      field = "";
      record = [];
    } else {
      field += char;
    }
  }
  record.push(field);
  if (record.some((value) => value.trim())) records.push(record);
  if (records.length < 2) return [];
  const headers = records[0].map(normalizeHeader);
  return records.slice(1).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index]?.trim() || ""])));
}

function buildTeamResultRow(row, index, sourceId, importRunId, args) {
  const teamName = required(firstPresent(row, ["team_name", "team", "team_name_raw", "name"]), `row ${index + 2} team_name`);
  const totalTimeText = firstPresent(row, ["total_time", "total", "time", "total_time_text"]);
  return {
    source_id: sourceId,
    import_run_id: importRunId,
    year: args.year,
    race_name: firstPresent(row, ["race_name", "race"]) || "Lake Tahoe Relay",
    row_index: index,
    row_label: String(index + 2),
    team_name_raw: teamName,
    team_name_normalized: normalizeName(teamName),
    bib: firstPresent(row, ["bib", "number", "team_number"]),
    division: firstPresent(row, ["division", "category"]),
    overall_place: parseInteger(firstPresent(row, ["overall_place", "place", "place_overall"])),
    division_place: parseInteger(firstPresent(row, ["division_place", "place_division"])),
    total_time_text: totalTimeText || null,
    total_time_seconds: timeTextToSeconds(totalTimeText),
    raw_text: firstPresent(row, ["raw_text", "source_row"]) || Object.values(row).filter(Boolean).join(" | "),
    is_our_team: isOurTeamName(teamName),
    review_status: "imported",
    metadata: { imported_from: path.basename(args.file), csv_row: index + 2 },
  };
}

async function upsertCsvSource(client, args, rowCount) {
  const statHash = `${args.year}-${path.basename(args.file)}-${rowCount}`.padEnd(64, "0").slice(0, 64).replace(/[^0-9a-f]/gi, "0").toLowerCase();
  const { data, error } = await client
    .from("raw_result_sources")
    .upsert(
      {
        provider: "lake_tahoe_relay",
        race_name: "Lake Tahoe Relay",
        year: args.year,
        source_url: `file://${path.resolve(args.file)}`,
        local_path: args.file,
        original_filename: path.basename(args.file),
        file_type: "csv",
        sha256: statHash,
        extraction_status: "extracted",
        extraction_method: "one_off_csv",
        metadata: { row_count: rowCount },
      },
      { onConflict: "provider,source_url" }
    )
    .select("id")
    .single();
  if (error) throw new Error(`Could not upsert CSV source: ${error.message}`);
  return data.id;
}

async function createImportRun(client, args, rowCount) {
  const { data, error } = await client
    .from("import_runs")
    .insert({
      import_type: "historical_team_results_csv",
      status: "running",
      script_version: "scripts/supabase/import-historical-team-results-csv.mjs",
      summary: { file: args.file, year: args.year, rows: rowCount },
    })
    .select("id")
    .single();
  if (error) throw new Error(`Could not create import run: ${error.message}`);
  return data.id;
}

async function finishImportRun(client, id, status, summary, errorMessage = null) {
  const { error } = await client.from("import_runs").update({ status, finished_at: new Date().toISOString(), summary, error_message: errorMessage }).eq("id", id);
  if (error) throw new Error(`Could not finish import run: ${error.message}`);
}

async function insertBatches(client, table, rows) {
  for (let offset = 0; offset < rows.length; offset += 500) {
    const batch = rows.slice(offset, offset + 500);
    const { error } = await client.from(table).insert(batch);
    if (error) throw new Error(`Could not insert ${table}: ${error.message}`);
  }
}

async function checkedDelete(query, label) {
  const { error } = await query;
  if (error) throw new Error(`Could not delete ${label}: ${error.message}`);
}

function firstPresent(row, names) {
  for (const name of names) {
    if (row[name]) return row[name];
  }
  return null;
}

function required(value, label) {
  if (!value) throw new Error(`Missing ${label}`);
  return value;
}

function normalizeHeader(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function normalizeName(value) {
  return String(value || "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

function parseInteger(value) {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isInteger(parsed) ? parsed : null;
}

function timeTextToSeconds(value) {
  const match = String(value || "").trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/);
  if (!match) return null;
  const first = Number(match[1]);
  const second = Number(match[2]);
  const third = match[3] == null ? null : Number(match[3]);
  return third == null ? first * 60 + second : first * 3600 + second * 60 + third;
}

function isOurTeamName(teamName) {
  return /(?:x|ex)treme|falcon/i.test(teamName || "");
}

function parseYear(value) {
  const year = Number.parseInt(String(value), 10);
  if (!Number.isInteger(year) || year < 1900 || year > 2100) throw new Error(`Invalid year: ${value}`);
  return year;
}

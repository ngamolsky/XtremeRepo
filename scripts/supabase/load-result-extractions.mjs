import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { resolveSupabaseTarget } from "./target.mjs";

const DEFAULT_INPUT_DIR = "data/processed/lake-tahoe-relay/extracted";
const BATCH_SIZE = 500;

const args = parseArgs(process.argv.slice(2));
const target = await resolveSupabaseTarget({ mode: args.mode, projectRef: args.projectRef });
const client = createClient(target.url, target.serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const files = selectExtractionFiles(args);

if (files.length === 0) {
  throw new Error("No extracted result JSON files matched the load filters.");
}

const importRunId = await createImportRun(client, {
  inputDir: args.inputDir,
  fileCount: files.length,
  years: [...args.years],
  reload: args.reload,
});
const summary = {
  files: 0,
  sources: 0,
  documents: 0,
  rows: 0,
  cells: 0,
  teamResults: 0,
  warnings: 0,
};

try {
  for (const filePath of files) {
    const extraction = JSON.parse(readFileSync(filePath, "utf8"));
    const loaded = await loadExtraction(client, extraction, importRunId, args);

    summary.files += 1;
    summary.sources += 1;
    summary.documents += loaded.documents;
    summary.rows += loaded.rows;
    summary.cells += loaded.cells;
    summary.teamResults += loaded.teamResults;
    summary.warnings += loaded.warnings;

    console.log(
      `[${extraction.source.year}] loaded source=${loaded.sourceId} documents=${loaded.documents}, rows=${loaded.rows}, cells=${loaded.cells}, teamResults=${loaded.teamResults}, warnings=${loaded.warnings}`
    );
  }

  await finishImportRun(client, importRunId, "success", summary);
  console.log(
    `Loaded ${summary.files} extraction file(s) into ${target.mode} (${target.projectRef}): sources=${summary.sources}, documents=${summary.documents}, rows=${summary.rows}, cells=${summary.cells}, teamResults=${summary.teamResults}, warnings=${summary.warnings}`
  );
} catch (error) {
  await finishImportRun(client, importRunId, "failed", summary, error.message);
  throw error;
}

function parseArgs(argv) {
  const parsed = {
    mode: "local",
    projectRef: "",
    inputDir: DEFAULT_INPUT_DIR,
    years: new Set(),
    reload: true,
  };

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
    } else if (arg === "--input-dir") {
      parsed.inputDir = argv[++index];
    } else if (arg.startsWith("--input-dir=")) {
      parsed.inputDir = arg.slice("--input-dir=".length);
    } else if (arg === "--year") {
      parsed.years.add(parseYear(argv[++index]));
    } else if (arg.startsWith("--year=")) {
      parsed.years.add(parseYear(arg.slice("--year=".length)));
    } else if (arg === "--no-reload") {
      parsed.reload = false;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return parsed;
}

function selectExtractionFiles(args) {
  const inputDir = path.resolve(args.inputDir);
  return readdirSync(inputDir)
    .filter((name) => /^\d{4}-.+\.json$/.test(name))
    .filter((name) => args.years.size === 0 || args.years.has(Number(name.slice(0, 4))))
    .map((name) => path.join(inputDir, name))
    .sort();
}

async function loadExtraction(client, extraction, importRunId, args) {
  const sourceId = await upsertSource(client, extraction);

  if (args.reload) {
    await deleteExistingSourceExtraction(client, sourceId);
  }

  const warnings = await insertExtractionWarnings(client, importRunId, sourceId, extraction);
  const teamResults = [];
  let documentCount = 0;
  let rowCount = 0;
  let cellCount = 0;

  for (const document of extraction.documents || []) {
    const documentId = await insertDocument(client, sourceId, document);
    documentCount += 1;

    const cells = (document.cells || []).map((cell) => ({
      source_id: sourceId,
      document_id: documentId,
      sheet_name: document.name,
      row_index: cell.row_index,
      column_index: cell.column_index,
      cell_ref: cell.cell_ref,
      raw_value: cell.raw_value,
      normalized_value: cell.normalized_value,
      value_type: coerceValueType(cell.value_type),
      formula: cell.formula,
      style_json: compactObject({ number_format: cell.number_format }),
      confidence: 1,
    }));
    await insertBatches(client, "raw_result_cells", cells);
    cellCount += cells.length;

    const rowRows = (document.rows || []).filter((row) => (row.raw_text || "").trim().length > 0);
    const insertedRows = await insertRows(client, sourceId, documentId, rowRows);
    rowCount += insertedRows.length;

    for (const insertedRow of insertedRows) {
      const parsedTeamResult = parseHistoricalTeamResultRow({
        sourceId,
        documentId,
        rawRowId: insertedRow.id,
        importRunId,
        year: extraction.source.year,
        raceName: "Lake Tahoe Relay",
        document,
        row: insertedRow.originalRow,
      });
      if (parsedTeamResult) {
        teamResults.push(parsedTeamResult);
      }
    }
  }

  await insertBatches(client, "historical_team_results", teamResults);
  await updateSourceStatus(client, sourceId, extraction);

  return {
    sourceId,
    documents: documentCount,
    rows: rowCount,
    cells: cellCount,
    teamResults: teamResults.length,
    warnings,
  };
}

async function upsertSource(client, extraction) {
  const source = extraction.source;
  const { data, error } = await client
    .from("raw_result_sources")
    .upsert(
      {
        provider: "lake_tahoe_relay",
        race_name: "Lake Tahoe Relay",
        year: source.year,
        source_url: source.source_url,
        final_url: source.final_url,
        local_path: source.filename,
        original_filename: path.basename(source.filename),
        file_type: source.file_type,
        content_type: source.content_type,
        bytes: source.bytes,
        sha256: source.sha256,
        extraction_status: mapExtractionStatus(extraction.extraction.status),
        extraction_method: extraction.extraction.method,
        metadata: {
          label: source.label,
          actual_sha256: source.actual_sha256,
          summary: extraction.summary,
        },
      },
      { onConflict: "provider,source_url" }
    )
    .select("id")
    .single();

  if (error) {
    throw new Error(`Could not upsert source ${source.year}: ${error.message}`);
  }

  return data.id;
}

async function deleteExistingSourceExtraction(client, sourceId) {
  await checkedDelete(client.from("historical_team_results").delete().eq("source_id", sourceId), "historical_team_results");
  await checkedDelete(client.from("raw_result_documents").delete().eq("source_id", sourceId), "raw_result_documents");
}

async function insertDocument(client, sourceId, document) {
  const { data, error } = await client
    .from("raw_result_documents")
    .insert({
      source_id: sourceId,
      document_type: document.document_type,
      name: document.name,
      page_number: document.page_number,
      sheet_index: document.sheet_index,
      row_count: document.row_count,
      column_count: document.column_count,
      extraction_status: mapExtractionStatus(document.extraction_status),
      metadata: document.metadata || {},
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Could not insert document ${document.name}: ${error.message}`);
  }

  return data.id;
}

async function insertRows(client, sourceId, documentId, rows) {
  const payload = rows.map((row) => ({
    source_id: sourceId,
    document_id: documentId,
    row_index: row.row_index,
    row_label: row.row_label,
    raw_text: row.raw_text,
    cells: cellsObject(row.cells),
    parsed_json: {},
    row_kind: inferRowKind(row.raw_text),
    parse_status: "unparsed",
    confidence: null,
  }));
  const inserted = [];

  for (let offset = 0; offset < payload.length; offset += BATCH_SIZE) {
    const batchPayload = payload.slice(offset, offset + BATCH_SIZE);
    const { data, error } = await client
      .from("raw_result_rows")
      .insert(batchPayload)
      .select("id,row_index,row_label,raw_text,row_kind");

    if (error) {
      throw new Error(`Could not insert raw_result_rows batch: ${error.message}`);
    }

    for (let index = 0; index < data.length; index += 1) {
      inserted.push({ ...data[index], originalRow: rows[offset + index] });
    }
  }

  return inserted;
}

async function insertBatches(client, table, rows) {
  for (let offset = 0; offset < rows.length; offset += BATCH_SIZE) {
    const batch = rows.slice(offset, offset + BATCH_SIZE);
    if (batch.length === 0) {
      continue;
    }
    const { error } = await client.from(table).insert(batch);
    if (error) {
      throw new Error(`Could not insert ${table} batch: ${error.message}`);
    }
  }
}

async function insertExtractionWarnings(client, importRunId, sourceId, extraction) {
  const warningRows = (extraction.extraction.warnings || []).map((message) => ({
    import_run_id: importRunId,
    source_id: sourceId,
    entity_type: extraction.source.file_type === "pdf" ? "document" : extraction.source.file_type.match(/jpg|jpeg|gif|png/) ? "ocr" : "source",
    severity: extraction.extraction.status === "failed" ? "error" : "warning",
    message,
    details: {
      year: extraction.source.year,
      method: extraction.extraction.method,
      status: extraction.extraction.status,
    },
  }));

  await insertBatches(client, "import_warnings", warningRows);
  return warningRows.length;
}

function parseHistoricalTeamResultRow({ sourceId, documentId, rawRowId, importRunId, year, raceName, document, row }) {
  const rawText = (row.raw_text || "").trim();
  if (!rawText || !/\b\d{1,2}:\d{2}(?::\d{2})?(?:\.\d+)?\b/.test(rawText)) {
    return null;
  }
  const parsed = rawText.includes("|") ? parsePipeTeamResult(rawText) : parseWhitespaceTeamResult(rawText);
  if (!parsed || !parsed.teamName || !parsed.totalTimeText) {
    return null;
  }

  return {
    source_id: sourceId,
    document_id: documentId,
    raw_row_id: rawRowId,
    import_run_id: importRunId,
    year,
    race_name: raceName,
    row_index: row.row_index,
    row_label: row.row_label,
    team_name_raw: parsed.teamName,
    team_name_normalized: normalizeName(parsed.teamName),
    bib: parsed.bib,
    division: parsed.division,
    overall_place: parsed.overallPlace,
    division_place: parsed.divisionPlace,
    total_time_text: parsed.totalTimeText,
    total_time_seconds: timeTextToSeconds(parsed.totalTimeText),
    raw_text: rawText,
    is_our_team: isOurTeamName(parsed.teamName),
    metadata: {
      document_type: document.document_type,
      document_name: document.name,
      sheet_index: document.sheet_index,
      page_number: document.page_number,
      parser: parsed.parser,
    },
  };
}

function parsePipeTeamResult(rawText) {
  const fields = rawText.split("|").map((field) => field.trim());
  const timeIndex = fields.findIndex((field) => timeTextToSeconds(field) != null);
  if (timeIndex === -1) {
    return null;
  }
  const likelyTeamIndex = Math.max(0, timeIndex - 2);
  return {
    parser: "pipe",
    overallPlace: parseInteger(fields[0]),
    bib: fields[1] || null,
    teamName: fields[2] || fields[likelyTeamIndex] || null,
    division: fields[3] || null,
    totalTimeText: fields[timeIndex] || null,
    divisionPlace: null,
  };
}

function parseWhitespaceTeamResult(rawText) {
  const times = [...rawText.matchAll(/\b\d{1,2}:\d{2}(?::\d{2})?(?:\.\d+)?\b/g)];
  const firstTime = times[0];
  if (!firstTime) {
    return null;
  }
  const beforeTime = rawText.slice(0, firstTime.index).trim();
  const { division, beforeDivision } = extractDivision(beforeTime);
  const leading = beforeDivision.match(/^\s*(\d+)\s+(\S+)\s+(.+)$/);
  if (!leading) {
    return null;
  }
  const secondTokenIsNumeric = /^\d+$/.test(leading[2]);
  const overallPlace = secondTokenIsNumeric ? parseInteger(leading[1]) : null;
  const bib = secondTokenIsNumeric ? leading[2] : leading[1];
  const teamName = (secondTokenIsNumeric ? leading[3] : `${leading[2]} ${leading[3]}`).trim();
  return {
    parser: "whitespace",
    overallPlace,
    bib,
    teamName,
    division,
    totalTimeText: firstTime[0],
    divisionPlace: null,
  };
}

function extractDivision(value) {
  const divisionPattern = /\b((?:Mixed|Men'?s|Women'?s)\s+(?:Open|Masters(?:\s+\d+\+)?|Senior(?:s)?(?:\s+\d+\+)?|Ultra|Corporate|Family|Public Safety))\s*$/i;
  const match = value.match(divisionPattern);
  if (!match || match.index == null) {
    return { division: null, beforeDivision: value.trim() };
  }
  return {
    division: match[1].replace(/\s+/g, " ").trim(),
    beforeDivision: value.slice(0, match.index).trim(),
  };
}

function parseInteger(value) {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isInteger(parsed) ? parsed : null;
}

function timeTextToSeconds(value) {
  const match = String(value || "").trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/);
  if (!match) {
    return null;
  }
  const first = Number(match[1]);
  const second = Number(match[2]);
  const third = match[3] == null ? null : Number(match[3]);
  if (third == null) {
    return first * 60 + second;
  }
  return first * 3600 + second * 60 + third;
}

function normalizeName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function isOurTeamName(teamName) {
  return /(?:x|ex)treme|falcon/i.test(teamName || "");
}

function cellsObject(cells) {
  if (!Array.isArray(cells)) {
    return {};
  }
  return Object.fromEntries(
    cells.map((cell) => [
      cell.cell_ref || `${cell.row_index}:${cell.column_index}`,
      {
        row_index: cell.row_index,
        column_index: cell.column_index,
        raw_value: cell.raw_value,
        normalized_value: cell.normalized_value,
        value_type: cell.value_type,
      },
    ])
  );
}

function inferRowKind(rawText = "") {
  const text = rawText.toLowerCase();
  if (/\b(bib|team|runner|leg|time|place|division)\b/.test(text)) {
    return "header";
  }
  if (/\b(open|mixed|men|women|masters|senior|division)\b/.test(text)) {
    return "team_summary";
  }
  if (/\b\d{1,2}:\d{2}(?::\d{2})?\b/.test(text) && /\bleg\b|\brunner\b|\b[1-7]\b/.test(text)) {
    return "leg_result";
  }
  if (/\bnote|adjust|penalty|dq|disqualified\b/.test(text)) {
    return "notes";
  }
  return "unknown";
}

function compactObject(value) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== null && entry !== undefined && entry !== ""));
}

function coerceValueType(value) {
  return ["text", "number", "time", "date", "blank", "formula", "unknown"].includes(value) ? value : "unknown";
}

function mapExtractionStatus(status) {
  if (["pending", "extracted", "partial", "failed", "needs_review"].includes(status)) {
    return status;
  }
  return "needs_review";
}

async function createImportRun(client, summary) {
  const { data, error } = await client
    .from("import_runs")
    .insert({
      import_type: "load",
      status: "running",
      script_version: "scripts/supabase/load-result-extractions.mjs",
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
      summary,
      error_message: errorMessage,
    })
    .eq("id", id);

  if (error) {
    throw new Error(`Could not finish import_runs row ${id}: ${error.message}`);
  }
}

async function updateSourceStatus(client, sourceId, extraction) {
  const { error } = await client
    .from("raw_result_sources")
    .update({
      extraction_status: mapExtractionStatus(extraction.extraction.status),
      extraction_method: extraction.extraction.method,
      metadata: {
        label: extraction.source.label,
        actual_sha256: extraction.source.actual_sha256,
        summary: extraction.summary,
        loaded_at: new Date().toISOString(),
      },
    })
    .eq("id", sourceId);

  if (error) {
    throw new Error(`Could not update source status ${sourceId}: ${error.message}`);
  }
}

async function checkedDelete(query, label) {
  const { error } = await query;
  if (error) {
    throw new Error(`Could not delete existing ${label}: ${error.message}`);
  }
}

function parseYear(value) {
  const year = Number.parseInt(String(value), 10);
  if (!Number.isInteger(year) || year < 1900 || year > 2100) {
    throw new Error(`Invalid year: ${value}`);
  }
  return year;
}

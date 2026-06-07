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
  chunks: 0,
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
    summary.chunks += loaded.chunks;
    summary.warnings += loaded.warnings;

    console.log(
      `[${extraction.source.year}] loaded source=${loaded.sourceId} documents=${loaded.documents}, rows=${loaded.rows}, cells=${loaded.cells}, chunks=${loaded.chunks}, warnings=${loaded.warnings}`
    );
  }

  await finishImportRun(client, importRunId, "success", summary);
  console.log(
    `Loaded ${summary.files} extraction file(s) into ${target.mode} (${target.projectRef}): sources=${summary.sources}, documents=${summary.documents}, rows=${summary.rows}, cells=${summary.cells}, chunks=${summary.chunks}, warnings=${summary.warnings}`
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
  const chunks = [];
  let documentCount = 0;
  let rowCount = 0;
  let cellCount = 0;

  chunks.push(sourceSummaryChunk(sourceId, extraction));

  for (const document of extraction.documents || []) {
    const documentId = await insertDocument(client, sourceId, document);
    documentCount += 1;
    chunks.push(documentChunk(sourceId, documentId, extraction, document));

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
      chunks.push(rowChunk(sourceId, documentId, insertedRow.id, extraction, document, insertedRow.originalRow));
    }
  }

  await insertBatches(client, "result_search_chunks", chunks);
  await updateSourceStatus(client, sourceId, extraction);

  return {
    sourceId,
    documents: documentCount,
    rows: rowCount,
    cells: cellCount,
    chunks: chunks.length,
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
  await checkedDelete(client.from("result_search_chunks").delete().eq("source_id", sourceId), "result_search_chunks");
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

function sourceSummaryChunk(sourceId, extraction) {
  const source = extraction.source;
  return {
    source_id: sourceId,
    year: source.year,
    chunk_type: "source_summary",
    chunk_text: `${source.year} Lake Tahoe Relay historical result source ${source.original_filename || path.basename(source.filename)} ${source.file_type} ${extraction.summary.rows} extracted rows ${extraction.summary.cells} extracted cells`,
    structured_json: {
      source_url: source.source_url,
      final_url: source.final_url,
      filename: source.filename,
      file_type: source.file_type,
      extraction_status: extraction.extraction.status,
      extraction_method: extraction.extraction.method,
      summary: extraction.summary,
    },
  };
}

function documentChunk(sourceId, documentId, extraction, document) {
  const label = document.name || (document.page_number ? `Page ${document.page_number}` : "Document");
  return {
    source_id: sourceId,
    document_id: documentId,
    year: extraction.source.year,
    chunk_type: document.document_type === "pdf_page" ? "page" : document.document_type === "image" ? "ocr_block" : "sheet",
    chunk_text: `${extraction.source.year} Lake Tahoe Relay ${label} ${document.document_type} ${document.row_count || 0} rows ${document.column_count || 0} columns`,
    structured_json: {
      document_type: document.document_type,
      name: document.name,
      sheet_index: document.sheet_index,
      page_number: document.page_number,
      row_count: document.row_count,
      column_count: document.column_count,
    },
  };
}

function rowChunk(sourceId, documentId, rawRowId, extraction, document, row) {
  return {
    source_id: sourceId,
    document_id: documentId,
    raw_row_id: rawRowId,
    year: extraction.source.year,
    chunk_type: row.raw_text.length > 500 ? "notes" : inferChunkType(row.raw_text),
    chunk_text: `${extraction.source.year} ${document.name || document.document_type} row ${row.row_label}: ${row.raw_text}`,
    structured_json: {
      document_type: document.document_type,
      document_name: document.name,
      sheet_index: document.sheet_index,
      page_number: document.page_number,
      row_index: row.row_index,
      row_label: row.row_label,
    },
    team_name: inferTeamName(row.raw_text),
    runner_name: null,
    leg_number: inferLegNumber(row.raw_text),
    leg_version: 1,
  };
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

function inferChunkType(rawText = "") {
  const kind = inferRowKind(rawText);
  if (kind === "leg_result") {
    return "leg_result";
  }
  if (kind === "team_summary" || kind === "division_summary") {
    return "team_result";
  }
  if (kind === "notes") {
    return "notes";
  }
  return "row";
}

function inferTeamName(rawText = "") {
  const parts = rawText.split("|").map((part) => part.trim()).filter(Boolean);
  return parts.find((part) => /xtreme|falcon|team/i.test(part)) || null;
}

function inferLegNumber(rawText = "") {
  const match = rawText.match(/\bleg\s*([1-7])\b/i);
  return match ? Number(match[1]) : null;
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

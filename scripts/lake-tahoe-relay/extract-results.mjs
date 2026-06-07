import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import XLSX from "xlsx";

const DEFAULT_MANIFEST = "data/raw/lake-tahoe-relay/results/manifest.json";
const DEFAULT_OUTPUT_DIR = "data/processed/lake-tahoe-relay/extracted";
const SUPPORTED_EXCEL_TYPES = new Set(["xls", "xlsx", "csv", "ods"]);
const SUPPORTED_PDF_TYPES = new Set(["pdf"]);
const SUPPORTED_IMAGE_TYPES = new Set(["jpg", "jpeg", "gif", "png"]);

const args = parseArgs(process.argv.slice(2));
const manifestPath = path.resolve(args.manifest);
const outputDir = path.resolve(args.outputDir);
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const selectedFiles = selectFiles(manifest.files || [], args);

if (selectedFiles.length === 0) {
  throw new Error("No manifest files matched the extraction filters.");
}

mkdirSync(outputDir, { recursive: true });

const summaries = [];

for (const fileEntry of selectedFiles) {
  const extracted = extractFile(fileEntry);
  const outputPath = path.join(outputDir, `${fileEntry.year || "unknown"}-${slugBase(fileEntry.filename)}.json`);

  if (!args.dryRun) {
    writeFileSync(outputPath, `${JSON.stringify(extracted, null, 2)}\n`);
  }

  summaries.push({
    year: fileEntry.year,
    file_type: fileEntry.file_type,
    status: extracted.extraction.status,
    method: extracted.extraction.method,
    documents: extracted.documents.length,
    rows: extracted.summary.rows,
    cells: extracted.summary.cells,
    characters: extracted.summary.characters,
    warnings: extracted.extraction.warnings.length,
    output_path: args.dryRun ? null : path.relative(process.cwd(), outputPath),
  });

  console.log(
    `[${fileEntry.year}] ${extracted.extraction.status} via ${extracted.extraction.method}: documents=${extracted.documents.length}, rows=${extracted.summary.rows}, cells=${extracted.summary.cells}, chars=${extracted.summary.characters}${args.dryRun ? " (dry-run)" : ""}`
  );
}

const summaryPath = path.join(outputDir, "summary.json");
const runSummary = {
  source_page: manifest.source_page,
  manifest: path.relative(process.cwd(), manifestPath),
  generated_at: new Date().toISOString(),
  files_selected: summaries.length,
  summaries,
};

if (!args.dryRun) {
  writeFileSync(summaryPath, `${JSON.stringify(runSummary, null, 2)}\n`);
}

console.log(
  `Extracted ${summaries.length} file(s). status=${summaries.map((item) => `${item.year}:${item.status}`).join(", ")}`
);

function parseArgs(argv) {
  const parsed = {
    manifest: DEFAULT_MANIFEST,
    outputDir: DEFAULT_OUTPUT_DIR,
    years: new Set(),
    all: false,
    spreadsheetsOnly: false,
    includeReviewFormats: false,
    dryRun: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--manifest") {
      parsed.manifest = argv[++index];
    } else if (arg.startsWith("--manifest=")) {
      parsed.manifest = arg.slice("--manifest=".length);
    } else if (arg === "--output-dir") {
      parsed.outputDir = argv[++index];
    } else if (arg.startsWith("--output-dir=")) {
      parsed.outputDir = arg.slice("--output-dir=".length);
    } else if (arg === "--year") {
      parsed.years.add(parseYear(argv[++index]));
    } else if (arg.startsWith("--year=")) {
      parsed.years.add(parseYear(arg.slice("--year=".length)));
    } else if (arg === "--all") {
      parsed.all = true;
    } else if (arg === "--spreadsheets-only") {
      parsed.spreadsheetsOnly = true;
    } else if (arg === "--include-review-formats") {
      parsed.includeReviewFormats = true;
    } else if (arg === "--dry-run") {
      parsed.dryRun = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!parsed.all && parsed.years.size === 0) {
    parsed.spreadsheetsOnly = true;
  }

  return parsed;
}

function selectFiles(files, args) {
  return files
    .filter((file) => {
      if (args.years.size > 0 && !args.years.has(Number(file.year))) {
        return false;
      }
      if (args.spreadsheetsOnly && !SUPPORTED_EXCEL_TYPES.has(file.file_type)) {
        return false;
      }
      if (!args.includeReviewFormats && !SUPPORTED_EXCEL_TYPES.has(file.file_type) && args.years.size === 0) {
        return false;
      }
      return true;
    })
    .sort((a, b) => Number(a.year || 0) - Number(b.year || 0));
}

function extractFile(fileEntry) {
  const filePath = path.resolve(fileEntry.filename);
  const warnings = [];

  if (!existsSync(filePath)) {
    return buildExtraction(fileEntry, {
      documents: [],
      method: "missing_file",
      status: "failed",
      warnings: [`File not found: ${fileEntry.filename}`],
    });
  }

  const actualSha256 = sha256(filePath);
  if (fileEntry.sha256 && actualSha256 !== fileEntry.sha256) {
    warnings.push(`SHA-256 mismatch: manifest=${fileEntry.sha256}, actual=${actualSha256}`);
  }

  try {
    if (SUPPORTED_EXCEL_TYPES.has(fileEntry.file_type)) {
      return buildExtraction(fileEntry, {
        documents: extractWorkbook(filePath),
        method: "xlsx",
        status: warnings.length > 0 ? "partial" : "extracted",
        warnings,
        actualSha256,
      });
    }

    if (SUPPORTED_PDF_TYPES.has(fileEntry.file_type)) {
      return buildExtraction(fileEntry, {
        documents: extractPdf(filePath),
        method: "pdftotext-layout",
        status: warnings.length > 0 ? "partial" : "extracted",
        warnings,
        actualSha256,
      });
    }

    if (SUPPORTED_IMAGE_TYPES.has(fileEntry.file_type)) {
      return buildExtraction(fileEntry, {
        documents: extractImage(filePath),
        method: "tesseract-ocr",
        status: "needs_review",
        warnings: [...warnings, "Image OCR requires human review before parsing."],
        actualSha256,
      });
    }

    return buildExtraction(fileEntry, {
      documents: [],
      method: "unsupported",
      status: "needs_review",
      warnings: [...warnings, `Unsupported file_type: ${fileEntry.file_type}`],
      actualSha256,
    });
  } catch (error) {
    return buildExtraction(fileEntry, {
      documents: [],
      method: methodFor(fileEntry.file_type),
      status: "failed",
      warnings: [...warnings, error.message],
      actualSha256,
    });
  }
}

function extractWorkbook(filePath) {
  const workbook = XLSX.readFile(filePath, {
    cellDates: true,
    cellFormula: true,
    cellNF: true,
    cellStyles: true,
    dense: false,
  });

  return workbook.SheetNames.map((sheetName, sheetIndex) => {
    const sheet = workbook.Sheets[sheetName];
    const range = sheet["!ref"] ? XLSX.utils.decode_range(sheet["!ref"]) : null;
    const rowsByIndex = new Map();
    const cells = [];

    for (const cellRef of Object.keys(sheet)) {
      if (cellRef.startsWith("!")) {
        continue;
      }

      const decoded = XLSX.utils.decode_cell(cellRef);
      const cell = sheet[cellRef];
      const normalized = normalizeCell(cell);

      if (normalized.raw_value === "") {
        continue;
      }

      const extractedCell = {
        cell_ref: cellRef,
        row_index: decoded.r,
        column_index: decoded.c,
        column_label: XLSX.utils.encode_col(decoded.c),
        raw_value: normalized.raw_value,
        normalized_value: normalized.normalized_value,
        value_type: normalized.value_type,
        formula: cell.f || null,
        number_format: cell.z || null,
      };
      cells.push(extractedCell);

      if (!rowsByIndex.has(decoded.r)) {
        rowsByIndex.set(decoded.r, []);
      }
      rowsByIndex.get(decoded.r).push(extractedCell);
    }

    const rows = [...rowsByIndex.entries()]
      .sort(([left], [right]) => left - right)
      .map(([rowIndex, rowCells]) => {
        const sortedCells = rowCells.sort((left, right) => left.column_index - right.column_index);
        return {
          row_index: rowIndex,
          row_label: String(rowIndex + 1),
          raw_text: sortedCells.map((cell) => cell.normalized_value).filter(Boolean).join(" | "),
          cells: sortedCells,
        };
      });

    return {
      document_type: "sheet",
      name: sheetName,
      sheet_index: sheetIndex,
      page_number: null,
      row_count: range ? range.e.r - range.s.r + 1 : rows.length,
      column_count: range ? range.e.c - range.s.c + 1 : maxColumnCount(rows),
      extraction_status: "extracted",
      metadata: {
        range: sheet["!ref"] || null,
        merges: sheet["!merges"] || [],
      },
      cells,
      rows,
    };
  });
}

function extractPdf(filePath) {
  const text = execFileSync("pdftotext", ["-layout", filePath, "-"], {
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
  const pages = text.split("\f").map((page) => page.trimEnd()).filter((page) => page.trim().length > 0);

  return pages.map((pageText, pageIndex) => {
    const rows = pageText.split(/\r?\n/).map((line, lineIndex) => ({
      row_index: lineIndex,
      row_label: String(lineIndex + 1),
      raw_text: line,
      cells: {},
    }));

    return {
      document_type: "pdf_page",
      name: `Page ${pageIndex + 1}`,
      sheet_index: null,
      page_number: pageIndex + 1,
      row_count: rows.length,
      column_count: null,
      extraction_status: "extracted",
      metadata: {
        extraction: "pdftotext -layout",
      },
      cells: [],
      rows,
      text: pageText,
    };
  });
}

function extractImage(filePath) {
  const text = execFileSync("tesseract", [filePath, "stdout", "--psm", "6"], {
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
  const rows = text.trimEnd().split(/\r?\n/).map((line, lineIndex) => ({
    row_index: lineIndex,
    row_label: String(lineIndex + 1),
    raw_text: line,
    cells: {},
  }));

  return [
    {
      document_type: "image",
      name: path.basename(filePath),
      sheet_index: null,
      page_number: null,
      row_count: rows.length,
      column_count: null,
      extraction_status: "needs_review",
      metadata: {
        extraction: "tesseract --psm 6",
      },
      cells: [],
      rows,
      text,
    },
  ];
}

function buildExtraction(fileEntry, { documents, method, status, warnings, actualSha256 }) {
  const summary = summarizeDocuments(documents);

  return {
    schema_version: 1,
    extracted_at: new Date().toISOString(),
    source: {
      year: fileEntry.year,
      label: fileEntry.label,
      source_url: fileEntry.source_url,
      final_url: fileEntry.final_url,
      filename: fileEntry.filename,
      file_type: fileEntry.file_type,
      content_type: fileEntry.content_type,
      bytes: fileEntry.bytes,
      sha256: fileEntry.sha256,
      actual_sha256: actualSha256 || null,
    },
    extraction: {
      method,
      status,
      warnings,
    },
    summary,
    documents,
  };
}

function summarizeDocuments(documents) {
  return documents.reduce(
    (summary, document) => {
      summary.rows += document.rows?.length || 0;
      summary.cells += document.cells?.length || 0;
      summary.characters += (document.rows || []).reduce((count, row) => count + (row.raw_text || "").length, 0);
      return summary;
    },
    { rows: 0, cells: 0, characters: 0 }
  );
}

function normalizeCell(cell) {
  const value = cell.v;
  const display = cell.w ?? value;
  const normalizedValue = display instanceof Date ? display.toISOString() : String(display ?? "").trim();

  return {
    raw_value: value instanceof Date ? value.toISOString() : String(value ?? "").trim(),
    normalized_value: normalizedValue,
    value_type: valueType(cell, normalizedValue),
  };
}

function valueType(cell, normalizedValue) {
  if (cell.f) {
    return "formula";
  }
  if (normalizedValue === "") {
    return "blank";
  }
  if (cell.t === "n") {
    if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(normalizedValue)) {
      return "time";
    }
    return "number";
  }
  if (cell.t === "d") {
    return "date";
  }
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(normalizedValue)) {
    return "time";
  }
  return cell.t === "s" || cell.t === "str" ? "text" : "unknown";
}

function maxColumnCount(rows) {
  return rows.reduce((max, row) => Math.max(max, row.cells.length), 0);
}

function sha256(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function methodFor(fileType) {
  if (SUPPORTED_EXCEL_TYPES.has(fileType)) {
    return "xlsx";
  }
  if (SUPPORTED_PDF_TYPES.has(fileType)) {
    return "pdftotext-layout";
  }
  if (SUPPORTED_IMAGE_TYPES.has(fileType)) {
    return "tesseract-ocr";
  }
  return "unsupported";
}

function parseYear(value) {
  const year = Number.parseInt(String(value), 10);
  if (!Number.isInteger(year) || year < 1900 || year > 2100) {
    throw new Error(`Invalid year: ${value}`);
  }
  return year;
}

function slugBase(filename) {
  return path.basename(filename).replace(/\.[^.]+$/, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
}

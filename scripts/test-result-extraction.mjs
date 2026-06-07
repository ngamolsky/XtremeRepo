import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const repoRoot = new URL("..", import.meta.url);
const read = (filePath) => readFileSync(new URL(`../${filePath}`, import.meta.url), "utf8");
const script = read("scripts/lake-tahoe-relay/extract-results.mjs");
const packageJson = JSON.parse(read("package.json"));

assert.match(script, /import XLSX from "xlsx"/, "extractor should use xlsx for xls/xlsx workbook extraction");
assert.match(script, /pdftotext[\s\S]*-layout/, "extractor should preserve PDF text layout with pdftotext");
assert.match(script, /tesseract[\s\S]*--psm/, "extractor should OCR image scan years with tesseract");
assert.match(script, /sha256\(filePath\)/, "extractor should verify raw file checksums");
assert.match(script, /data\/processed\/lake-tahoe-relay\/extracted/, "extractor should write provenance JSON under the processed extraction directory");
assert.equal(packageJson.scripts["results:extract"], "node scripts/lake-tahoe-relay/extract-results.mjs");

const outputDir = mkdtempSync(path.join(tmpdir(), "ltr-extract-"));
execFileSync(
  "node",
  ["scripts/lake-tahoe-relay/extract-results.mjs", "--year", "2019", "--output-dir", outputDir],
  { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
);

const expectedPath = path.join(outputDir, "2019-2019-LakeTahoeRelay-Results-2019.json");
assert.ok(existsSync(expectedPath), "2019 extraction JSON should be written");

const extracted = JSON.parse(readFileSync(expectedPath, "utf8"));
assert.equal(extracted.schema_version, 1);
assert.equal(extracted.source.year, 2019);
assert.equal(extracted.source.file_type, "xlsx");
assert.equal(extracted.extraction.status, "extracted");
assert.equal(extracted.extraction.method, "xlsx");
assert.ok(extracted.documents.length > 0, "workbook should expose at least one sheet document");
assert.ok(extracted.summary.rows > 0, "workbook extraction should preserve non-empty rows");
assert.ok(extracted.summary.cells > 0, "workbook extraction should preserve non-empty cells");
assert.ok(
  extracted.documents.some((document) => document.rows.some((row) => row.raw_text.includes("Bib") || row.raw_text.includes("Team"))),
  "extracted workbook should preserve recognizable header/source row text"
);

console.log("result extraction tests passed");

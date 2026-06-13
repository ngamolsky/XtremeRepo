import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { resolveSupabaseTarget } from "./target.mjs";

const DEFAULT_ARCHIVE_ROOT = path.join(os.homedir(), "Desktop", "Xtreme Falcons Photo Archive");
const DEFAULT_MAX_DIMENSION = 2400;
const DEFAULT_JPEG_QUALITY = 82;
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".heic", ".webp"]);

const args = parseArgs(process.argv.slice(2));
const archiveRoot = path.resolve(args.archiveRoot || DEFAULT_ARCHIVE_ROOT);
const rawRoot = path.join(archiveRoot, "raw-media");
const optimizedRoot = path.join(archiveRoot, "supabase-optimized", "photos");
const manifestPath = path.join(archiveRoot, "supabase-optimized", "manifest.json");
const reportPath = path.join(archiveRoot, "supabase-optimized", "report.json");

const sourceDirs = new Map([
  ["Desktop 2019 Extreme Falcons", path.join(rawRoot, "2019 Extreme Falcons")],
  ["Desktop Tahoe Relay 2023", path.join(rawRoot, "Tahoe Relay 2023")],
  ["Desktop 2025 - Falcons", path.join(rawRoot, "2025 - falcons")],
  ["Desktop 2022 - Xtreme Falcons", path.join(rawRoot, "2022 - Xtreme Falcons")],
  ["Desktop 2022 - Xtreme Falcons HEIC converted", path.join(rawRoot, "2022 - Xtreme Falcons")],
  [
    "Peter Lubbers Lifetime Story 6_17_24.pptx",
    path.join(rawRoot, "Tahoe Relay images from Peter deck"),
  ],
]);

if (!existsSync("/usr/bin/sips")) {
  throw new Error("This script requires /usr/bin/sips for local image conversion.");
}

mkdirSync(optimizedRoot, { recursive: true });

if (args.clean && existsSync(optimizedRoot)) {
  rmSync(optimizedRoot, { recursive: true, force: true });
  mkdirSync(optimizedRoot, { recursive: true });
}

const target = await resolveSupabaseTarget({ mode: "prod" });
const client = createClient(target.url, target.serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const existingRows = await fetchExistingPhotoRows(client);
const existingItems = buildExistingItems(existingRows);
const newItems = buildNew2026Items(path.join(rawRoot, "Extreme Falcons 2026"), existingRows.length);
const allItems = [...existingItems, ...newItems].sort((a, b) =>
  a.manifest.storage_path.localeCompare(b.manifest.storage_path)
);

const report = {
  archiveRoot,
  existingRows: existingItems.length,
  new2026Rows: newItems.length,
  inputBytes: 0,
  outputBytes: 0,
  items: [],
  maxDimension: args.maxDimension,
  jpegQuality: args.jpegQuality,
};

const manifestRows = [];

for (const [index, item] of allItems.entries()) {
  const outputPath = path.join(optimizedRoot, item.manifest.storage_path);
  mkdirSync(path.dirname(outputPath), { recursive: true });

  optimizeImage(item.sourcePath, outputPath, {
    jpegQuality: args.jpegQuality,
    maxDimension: args.maxDimension,
  });

  const inputBytes = statSync(item.sourcePath).size;
  const outputBytes = statSync(outputPath).size;

  report.inputBytes += inputBytes;
  report.outputBytes += outputBytes;
  report.items.push({
    inputBytes,
    outputBytes,
    originalFilename: item.manifest.original_filename,
    sourcePath: item.sourcePath,
    storagePath: item.manifest.storage_path,
  });

  manifestRows.push({
    ...item.manifest,
    content_type: "image/jpeg",
    file: item.manifest.storage_path,
  });

  if ((index + 1) % 25 === 0 || index + 1 === allItems.length) {
    const savedPercent =
      report.inputBytes > 0
        ? Math.round((1 - report.outputBytes / report.inputBytes) * 100)
        : 0;
    console.log(
      `[${index + 1}/${allItems.length}] ${formatBytes(report.inputBytes)} -> ${formatBytes(
        report.outputBytes
      )} (${savedPercent}% smaller)`
    );
  }
}

mkdirSync(path.dirname(manifestPath), { recursive: true });
writeFileSync(manifestPath, `${JSON.stringify(manifestRows, null, 2)}\n`);
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

console.log(`Wrote ${manifestRows.length} optimized photo manifest rows.`);
console.log(`Manifest: ${manifestPath}`);
console.log(`Photos: ${optimizedRoot}`);
console.log(`Report: ${reportPath}`);
console.log(
  `Total: ${formatBytes(report.inputBytes)} -> ${formatBytes(report.outputBytes)} (${Math.round(
    (1 - report.outputBytes / report.inputBytes) * 100
  )}% smaller)`
);

function parseArgs(argv) {
  const parsed = {
    archiveRoot: DEFAULT_ARCHIVE_ROOT,
    clean: false,
    jpegQuality: DEFAULT_JPEG_QUALITY,
    maxDimension: DEFAULT_MAX_DIMENSION,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--archive-root") {
      parsed.archiveRoot = argv[++index];
    } else if (arg === "--clean") {
      parsed.clean = true;
    } else if (arg === "--quality") {
      parsed.jpegQuality = parseNumber(argv[++index], "quality");
    } else if (arg === "--max-dimension") {
      parsed.maxDimension = parseNumber(argv[++index], "max-dimension");
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return parsed;
}

function parseNumber(value, label) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid --${label}: ${value}`);
  }

  return parsed;
}

async function fetchExistingPhotoRows(client) {
  const pageSize = 1000;
  const rows = [];

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await client
      .from("race_photos")
      .select(
        "storage_bucket,storage_path,year,event_name,race,caption,alt_text,category,tags,taken_on,sort_order,featured,source,original_filename"
      )
      .order("storage_path", { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) {
      throw new Error(`Failed fetching race_photos: ${error.message}`);
    }

    rows.push(...(data || []));

    if (!data || data.length < pageSize) {
      break;
    }
  }

  return rows;
}

function buildExistingItems(rows) {
  const sourceIndexes = new Map(
    Array.from(sourceDirs.entries()).map(([source, dir]) => [source, indexFilesByName(dir)])
  );

  return rows.map((row) => {
    const sourcePath = findSourcePath(sourceIndexes.get(row.source), row.original_filename);

    if (!sourcePath) {
      throw new Error(
        `Could not find local source for ${row.storage_path} (${row.source}/${row.original_filename})`
      );
    }

    return {
      sourcePath,
      manifest: {
        storage_bucket: row.storage_bucket,
        storage_path: row.storage_path,
        year: row.year,
        event_name: row.event_name,
        race: row.race,
        caption: row.caption,
        alt_text: row.alt_text,
        category: row.category,
        tags: row.tags || [],
        taken_on: row.taken_on,
        sort_order: row.sort_order,
        featured: row.featured,
        source: row.source,
        original_filename: row.original_filename,
      },
    };
  });
}

function buildNew2026Items(dir, sortOffset) {
  const files = walk(dir)
    .filter((filePath) => IMAGE_EXTENSIONS.has(path.extname(filePath).toLowerCase()))
    .sort((a, b) => path.basename(a).localeCompare(path.basename(b)));

  const storagePaths = new Map();

  return files.map((sourcePath, index) => {
    const storagePath = uniqueStoragePath(
      storagePaths,
      `2026/tahoe-relay/${safePathSegment(path.basename(sourcePath), ".jpg")}`
    );

    return {
      sourcePath,
      manifest: {
        storage_bucket: "race-photos",
        storage_path: storagePath,
        year: 2026,
        event_name: "Tahoe Relay",
        race: "Tahoe Relay",
        caption: null,
        alt_text: null,
        category: "team",
        tags: ["tahoe-relay", "xtreme-falcons", "2026"],
        taken_on: null,
        sort_order: sortOffset + index,
        featured: false,
        source: "Desktop Extreme Falcons 2026",
        original_filename: path.basename(sourcePath),
      },
    };
  });
}

function indexFilesByName(dir) {
  const map = new Map();

  for (const filePath of walk(dir)) {
    const basename = path.basename(filePath).toLowerCase();

    if (!map.has(basename)) {
      map.set(basename, []);
    }

    map.get(basename).push(filePath);
  }

  return map;
}

function findSourcePath(index, originalFilename) {
  if (!index || !originalFilename) {
    return null;
  }

  const direct = index.get(originalFilename.toLowerCase());

  if (direct?.length) {
    return direct[0];
  }

  const ext = path.extname(originalFilename);
  const base = ext ? originalFilename.slice(0, -ext.length) : originalFilename;
  const heic = index.get(`${base}.heic`.toLowerCase());

  if (heic?.length) {
    return heic[0];
  }

  return null;
}

function optimizeImage(sourcePath, outputPath, { jpegQuality, maxDimension }) {
  execFileSync(
    "/usr/bin/sips",
    [
      "-s",
      "format",
      "jpeg",
      "-s",
      "formatOptions",
      String(jpegQuality),
      "-Z",
      String(maxDimension),
      sourcePath,
      "--out",
      outputPath,
    ],
    { stdio: ["ignore", "pipe", "pipe"] }
  );
}

function walk(dir) {
  if (!existsSync(dir)) {
    throw new Error(`Missing source directory: ${dir}`);
  }

  const files = [];

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

function uniqueStoragePath(storagePaths, storagePath) {
  const parsed = path.posix.parse(storagePath);
  let candidate = storagePath;
  let suffix = 2;

  while (storagePaths.has(candidate)) {
    candidate = path.posix.join(parsed.dir, `${parsed.name}-${suffix}${parsed.ext}`);
    suffix += 1;
  }

  storagePaths.set(candidate, true);
  return candidate;
}

function safePathSegment(value, forcedExt) {
  const ext = forcedExt || path.extname(value).toLowerCase().replace(/[^a-z0-9.]/g, "");
  const base = path.extname(value) ? value.slice(0, -path.extname(value).length) : value;
  const safeBase = slugify(base);

  return `${safeBase || shortHash(value)}${ext}`;
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function shortHash(value) {
  return createHash("sha1").update(String(value)).digest("hex").slice(0, 10);
}

function formatBytes(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

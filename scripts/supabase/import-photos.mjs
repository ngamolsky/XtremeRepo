import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { resolveSupabaseTarget } from "./target.mjs";

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const DEFAULT_BUCKET = "race-photos";
const DEFAULT_EVENT = "Tahoe Relay";
const MAX_ATTEMPTS = 4;
const RETRY_BASE_MS = 1_000;

const args = parseArgs(process.argv.slice(2));

if (!args.dir) {
  throw new Error("Missing --dir /path/to/photos. Pass a folder or a parent folder with year subfolders.");
}

const rootDir = path.resolve(args.dir);
const target = args.dryRun
  ? {
      mode: args.mode,
      projectRef: args.projectRef || "dry-run",
    }
  : await resolveSupabaseTarget({
      mode: args.mode,
      projectRef: args.projectRef,
    });
const client = args.dryRun
  ? null
  : createClient(target.url, target.serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
const manifest = args.manifest ? readManifest(path.resolve(args.manifest)) : new Map();
const imageFiles = walk(rootDir).filter((filePath) =>
  IMAGE_EXTENSIONS.has(path.extname(filePath).toLowerCase())
);

if (imageFiles.length === 0) {
  throw new Error(`No image files found in ${rootDir}`);
}

if (!args.dryRun) {
  await ensureBucket(client, args.bucket);
}

const rows = [];

for (let index = 0; index < imageFiles.length; index += 1) {
  const filePath = imageFiles[index];
  const relativePath = toPosix(path.relative(rootDir, filePath));
  const fileMetadata = findManifestRow(manifest, relativePath, path.basename(filePath));
  const year = parseYear(fileMetadata.year || args.year || inferYear(relativePath, filePath));

  if (!year) {
    throw new Error(`Could not infer year for ${relativePath}. Use --year or a year folder.`);
  }

  const eventName = fileMetadata.event_name || args.event || DEFAULT_EVENT;
  const race = fileMetadata.race || args.race || eventName;
  const category = normalizeTag(fileMetadata.category || args.category || "team");
  const buffer = readFileSync(filePath);
  const dimensions = readImageDimensions(buffer);
  const contentType = fileMetadata.content_type || contentTypeFor(filePath);
  const storageBucket = fileMetadata.storage_bucket || args.bucket;
  const storagePath =
    fileMetadata.storage_path ||
    buildStoragePath({
      relativePath,
      year,
      eventName,
      filePath,
    });
  const tags = unique([
    slugify(eventName),
    ...parseTags(args.tags),
    ...parseTags(fileMetadata.tags),
  ]);
  const sortOrder = parseInteger(fileMetadata.sort_order, index);
  const featured = parseBoolean(fileMetadata.featured, false);
  const stat = statSync(filePath);
  const row = {
    storage_bucket: storageBucket,
    storage_path: storagePath,
    year,
    event_name: eventName,
    race,
    caption: fileMetadata.caption || args.caption || null,
    alt_text: fileMetadata.alt_text || fileMetadata.caption || args.caption || null,
    category,
    tags,
    taken_on: fileMetadata.taken_on || args.takenOn || null,
    sort_order: sortOrder,
    featured,
    source: fileMetadata.source || args.source || null,
    original_filename: fileMetadata.original_filename || path.basename(filePath),
    width: dimensions.width,
    height: dimensions.height,
    size_bytes: stat.size,
    content_type: contentType,
  };

  rows.push({ filePath, relativePath, buffer, contentType, row });
}

if (args.dryRun) {
  console.log(`Dry run for ${rows.length} image(s) against ${target.mode} (${target.projectRef}).`);
  for (const { relativePath, row } of rows) {
    console.log(`${relativePath} -> ${row.storage_bucket}/${row.storage_path}`);
  }
  process.exit(0);
}

for (const [index, item] of rows.entries()) {
  const { error: uploadError } = await withRetry(
    () =>
      client.storage.from(item.row.storage_bucket).upload(item.row.storage_path, item.buffer, {
        contentType: item.contentType,
        upsert: true,
      }),
    `uploading ${item.relativePath}`
  );

  if (uploadError) {
    throw new Error(`Failed uploading ${item.relativePath}: ${uploadError.message}`);
  }

  const { error: metadataError } = await withRetry(
    () => client.from("race_photos").upsert(item.row, { onConflict: "storage_bucket,storage_path" }),
    `upserting metadata for ${item.relativePath}`
  );

  if (metadataError) {
    throw new Error(`Failed upserting metadata for ${item.relativePath}: ${metadataError.message}`);
  }

  console.log(`[${index + 1}/${rows.length}] ${item.relativePath}`);
}

console.log(`Imported ${rows.length} photo(s) into ${target.mode} (${target.projectRef}).`);

function parseArgs(argv) {
  const parsed = {
    mode: "local",
    projectRef: "",
    bucket: DEFAULT_BUCKET,
    category: "team",
    dryRun: false,
    tags: "",
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
    } else if (arg === "--dir") {
      parsed.dir = argv[++index];
    } else if (arg === "--manifest") {
      parsed.manifest = argv[++index];
    } else if (arg === "--year") {
      parsed.year = argv[++index];
    } else if (arg === "--event") {
      parsed.event = argv[++index];
    } else if (arg === "--race") {
      parsed.race = argv[++index];
    } else if (arg === "--category") {
      parsed.category = argv[++index];
    } else if (arg === "--tags") {
      parsed.tags = argv[++index];
    } else if (arg === "--source") {
      parsed.source = argv[++index];
    } else if (arg === "--caption") {
      parsed.caption = argv[++index];
    } else if (arg === "--taken-on") {
      parsed.takenOn = argv[++index];
    } else if (arg === "--bucket") {
      parsed.bucket = argv[++index];
    } else if (arg === "--project-ref") {
      parsed.projectRef = argv[++index];
    } else if (arg.startsWith("--project-ref=")) {
      parsed.projectRef = arg.slice("--project-ref=".length);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return parsed;
}

async function ensureBucket(client, bucket) {
  const { data, error } = await client.storage.getBucket(bucket);

  if (!error && data) {
    return;
  }

  const { error: createError } = await client.storage.createBucket(bucket, {
    public: true,
    fileSizeLimit: 52428800,
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
  });

  if (createError) {
    throw new Error(`Could not create storage bucket ${bucket}: ${createError.message}`);
  }
}

async function withRetry(operation, label) {
  let result = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    result = await operation();

    if (!result.error || attempt === MAX_ATTEMPTS) {
      return result;
    }

    const delayMs = RETRY_BASE_MS * 2 ** (attempt - 1);
    console.warn(
      `Retrying ${label} after ${result.error.message} (${attempt}/${MAX_ATTEMPTS - 1})`
    );
    await sleep(delayMs);
  }

  return result;
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function walk(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files.sort((a, b) => a.localeCompare(b));
}

function readManifest(manifestPath) {
  const ext = path.extname(manifestPath).toLowerCase();

  if (ext === ".json") {
    const rows = JSON.parse(readFileSync(manifestPath, "utf8"));
    return rowsToManifestMap(Array.isArray(rows) ? rows : rows.photos || []);
  }

  const text = readFileSync(manifestPath, "utf8").trim();

  if (!text) {
    return new Map();
  }

  const [headerLine, ...lines] = text.split(/\r?\n/);
  const delimiter = headerLine.includes("\t") ? "\t" : ",";
  const headers = headerLine.split(delimiter).map((header) => header.trim());
  const rows = lines
    .filter(Boolean)
    .map((line) => {
      const values = line.split(delimiter);
      return Object.fromEntries(
        headers.map((header, index) => [header, (values[index] || "").trim()])
      );
    });

  return rowsToManifestMap(rows);
}

function rowsToManifestMap(rows) {
  const map = new Map();

  for (const row of rows) {
    if (!row.file) {
      continue;
    }

    map.set(toPosix(row.file), row);
  }

  return map;
}

function findManifestRow(manifest, relativePath, basename) {
  return manifest.get(relativePath) || manifest.get(basename) || {};
}

function inferYear(relativePath, filePath) {
  const relativeYear = relativePath.split("/").find((part) => /^(19|20)\d{2}$/.test(part));

  if (relativeYear) {
    return relativeYear;
  }

  return filePath
    .split(path.sep)
    .find((part) => /^(19|20)\d{2}$/.test(part));
}

function parseYear(value) {
  const year = Number.parseInt(String(value || ""), 10);
  return year >= 1900 && year <= 2100 ? year : null;
}

function parseInteger(value, fallback) {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseBoolean(value, fallback) {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  return ["1", "true", "yes", "y"].includes(String(value).trim().toLowerCase());
}

function buildStoragePath({ relativePath, year, eventName, filePath }) {
  const parts = relativePath.split("/");
  const yearIndex = parts.findIndex((part) => part === String(year));
  const rest = yearIndex >= 0 ? parts.slice(yearIndex + 1) : parts;
  const safeParts = rest.map(safePathSegment).filter(Boolean);

  if (safeParts.length === 0) {
    safeParts.push(safePathSegment(path.basename(filePath)));
  }

  return [String(year), slugify(eventName), ...safeParts].join("/");
}

function safePathSegment(value) {
  const ext = path.extname(value);
  const base = ext ? value.slice(0, -ext.length) : value;
  const safeBase = slugify(base);
  const safeExt = ext.toLowerCase().replace(/[^a-z0-9.]/g, "");

  return `${safeBase || shortHash(value)}${safeExt}`;
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeTag(value) {
  return slugify(value) || "other";
}

function parseTags(value) {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.map(normalizeTag).filter(Boolean);
  }

  return String(value)
    .split(/[;,]/)
    .map(normalizeTag)
    .filter(Boolean);
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function contentTypeFor(filePath) {
  switch (path.extname(filePath).toLowerCase()) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    default:
      return "application/octet-stream";
  }
}

function readImageDimensions(buffer) {
  if (isPng(buffer)) {
    return readPngDimensions(buffer);
  }

  if (isJpeg(buffer)) {
    return readJpegDimensions(buffer);
  }

  if (isWebp(buffer)) {
    return readWebpDimensions(buffer);
  }

  return { width: null, height: null };
}

function isPng(buffer) {
  return buffer.length >= 24 && buffer.readUInt32BE(0) === 0x89504e47;
}

function isJpeg(buffer) {
  return buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8;
}

function isWebp(buffer) {
  return buffer.length >= 12 && buffer.toString("ascii", 8, 12) === "WEBP";
}

function readPngDimensions(buffer) {
  if (
    buffer.length >= 24 &&
    buffer.readUInt32BE(0) === 0x89504e47 &&
    buffer.toString("ascii", 12, 16) === "IHDR"
  ) {
    return {
      width: buffer.readUInt32BE(16),
      height: buffer.readUInt32BE(20),
    };
  }

  return { width: null, height: null };
}

function readJpegDimensions(buffer) {
  let offset = 2;

  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = buffer[offset + 1];
    offset += 2;

    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) {
      continue;
    }

    const length = buffer.readUInt16BE(offset);

    if (
      marker >= 0xc0 &&
      marker <= 0xcf &&
      ![0xc4, 0xc8, 0xcc].includes(marker) &&
      offset + 7 < buffer.length
    ) {
      return {
        height: buffer.readUInt16BE(offset + 3),
        width: buffer.readUInt16BE(offset + 5),
      };
    }

    offset += length;
  }

  return { width: null, height: null };
}

function readWebpDimensions(buffer) {
  if (buffer.length < 30 || buffer.toString("ascii", 0, 4) !== "RIFF") {
    return { width: null, height: null };
  }

  const chunk = buffer.toString("ascii", 12, 16);

  if (chunk === "VP8X") {
    return {
      width: buffer.readUIntLE(24, 3) + 1,
      height: buffer.readUIntLE(27, 3) + 1,
    };
  }

  return { width: null, height: null };
}

function shortHash(value) {
  return createHash("sha1").update(value).digest("hex").slice(0, 10);
}

function toPosix(value) {
  return value.split(path.sep).join("/");
}

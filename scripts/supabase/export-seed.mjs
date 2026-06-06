import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { parseArgs, resolveSupabaseTarget } from "./target.mjs";

const args = parseArgs();
const target = await resolveSupabaseTarget(args);
const client = createClient(target.url, target.serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const [
  runners,
  legDefinitions,
  placements,
  legResultObservations,
  results,
  raceParticipations,
  racePhotos,
  racePhotoNotes,
] = await Promise.all([
  fetchAll("runners", "id,name,email", "name"),
  fetchAll("leg_definitions", "number,version,distance,elevation_gain", "number"),
  fetchPlacements(),
  fetchOptionalAll(
    "leg_result_observations",
    [
      "id",
      "year",
      "leg_number",
      "leg_version",
      "runner_id",
      "source_type",
      "source_label",
      "submitted_by_runner_id",
      "lap_time",
      "moving_time",
      "elapsed_time",
      "distance",
      "elevation_gain",
      "notes",
      "raw_metadata",
    ].join(","),
    "year"
  ),
  fetchResults(),
  fetchAll("race_participations", "year,runner_id,status,notes", "year"),
  fetchOptionalAll(
    "race_photos",
    [
      "id",
      "storage_bucket",
      "storage_path",
      "year",
      "event_name",
      "race",
      "caption",
      "alt_text",
      "category",
      "tags",
      "taken_on",
      "sort_order",
      "featured",
      "source",
      "original_filename",
      "width",
      "height",
      "size_bytes",
      "content_type",
    ].join(","),
    "year"
  ),
  fetchOptionalAll(
    "race_photo_notes",
    "photo_id,body,author_id,created_at,updated_at",
    "created_at"
  ),
]);

const runnerById = new Map(runners.map((runner) => [runner.id, runner]));
const racePhotoById = new Map((racePhotos || []).map((photo) => [photo.id, photo]));

assertUniqueRunnerNames(runners);
assertKnownRunnerReferences(results, "user_id", runnerById, "results");
assertKnownRunnerReferences(raceParticipations, "runner_id", runnerById, "race_participations");
if (racePhotos && racePhotoNotes) {
  assertKnownPhotoReferences(racePhotoNotes, racePhotoById);
}
if (legResultObservations) {
  assertKnownRunnerReferences(legResultObservations, "runner_id", runnerById, "leg_result_observations");
  assertKnownRunnerReferences(
    legResultObservations,
    "submitted_by_runner_id",
    runnerById,
    "leg_result_observations"
  );
}

const seedSql = renderSeedSql({
  generatedAt: new Date().toISOString(),
  target,
  runners,
  legDefinitions,
  placements,
  legResultObservations,
  results,
  raceParticipations,
  racePhotos,
  racePhotoNotes,
  runnerById,
  racePhotoById,
});

writeFileSync("supabase/seed.sql", seedSql);
console.log(`Wrote supabase/seed.sql from ${target.mode} (${target.projectRef}).`);

if (args.backup) {
  const backup = {
    generatedAt: new Date().toISOString(),
    target: {
      mode: target.mode,
      projectRef: target.projectRef,
      url: target.url,
    },
    public: {
      runners,
      legDefinitions,
      placements,
      legResultObservations,
      results,
      raceParticipations,
      racePhotos,
      racePhotoNotes,
    },
    authUsers: await listRunnerAuthUsers(client),
  };
  const timestamp = backup.generatedAt.replace(/[:.]/g, "-");
  const backupDir = ".backups/supabase";
  const backupPath = `${backupDir}/${target.mode}-${target.projectRef}-${timestamp}.json`;

  mkdirSync(backupDir, { recursive: true });
  writeFileSync(backupPath, `${JSON.stringify(backup, null, 2)}\n`);
  console.log(`Wrote private backup ${backupPath}.`);
}

async function fetchAll(table, columns, orderColumn) {
  const pageSize = 1000;
  const rows = [];

  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1;
    const { data, error } = await client
      .from(table)
      .select(columns)
      .order(orderColumn, { ascending: true })
      .range(from, to);

    if (error) {
      throw new Error(`Failed fetching ${table}: ${error.message}`);
    }

    rows.push(...(data || []));

    if (!data || data.length < pageSize) {
      break;
    }
  }

  return rows;
}

async function fetchOptionalAll(table, columns, orderColumn) {
  try {
    return await fetchAll(table, columns, orderColumn);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes(`Could not find the table 'public.${table}'`)
    ) {
      return null;
    }

    throw error;
  }
}

async function fetchResults() {
  try {
    return await fetchAll(
      "results",
      "year,leg_number,leg_version,lap_time,user_id,notes,source_type,canonical_observation_id",
      "year"
    );
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes("Could not find the 'source_type' column") ||
        error.message.includes("Could not find the 'canonical_observation_id' column"))
    ) {
      const rows = await fetchAll(
        "results",
        "year,leg_number,leg_version,lap_time,user_id,notes",
        "year"
      );

      return rows.map((row) => ({
        ...row,
        source_type: "official",
        canonical_observation_id: null,
      }));
    }

    throw error;
  }
}

async function fetchPlacements() {
  try {
    return await fetchAll(
      "placements",
      "year,division,division_place,division_teams,overall_place,overall_teams,bib,notes,race_start_time",
      "year"
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("Could not find the 'race_start_time' column")
    ) {
      const rows = await fetchAll(
        "placements",
        "year,division,division_place,division_teams,overall_place,overall_teams,bib,notes",
        "year"
      );

      return rows.map((row) => ({
        ...row,
        race_start_time: row.year === 2024 ? "06:00:00" : "07:00:00",
      }));
    }

    throw error;
  }
}

async function listRunnerAuthUsers(adminClient) {
  const runnerEmails = new Set(
    runners
      .map((runner) => normalizeEmail(runner.email))
      .filter(Boolean)
  );
  const authUsers = [];
  let page = 1;

  while (true) {
    const { data, error } = await adminClient.auth.admin.listUsers({
      page,
      perPage: 1000,
    });

    if (error) {
      throw error;
    }

    for (const user of data.users || []) {
      const email = normalizeEmail(user.email);

      if (runnerEmails.has(email)) {
        authUsers.push({
          id: user.id,
          email,
          created_at: user.created_at,
          confirmed_at: user.confirmed_at,
          email_confirmed_at: user.email_confirmed_at,
          last_sign_in_at: user.last_sign_in_at,
        });
      }
    }

    if (!data.users || data.users.length < 1000) {
      break;
    }

    page += 1;
  }

  return authUsers.sort((a, b) => a.email.localeCompare(b.email));
}

function renderSeedSql({
  generatedAt,
  target,
  runners,
  legDefinitions,
  placements,
  legResultObservations,
  results,
  raceParticipations,
  racePhotos,
  runnerById,
  racePhotoNotes,
  racePhotoById,
}) {
  const lines = [
    "-- Generated by scripts/supabase/export-seed.mjs.",
    `-- Source: ${target.mode} (${target.projectRef}) at ${generatedAt}.`,
    "-- Auth users are intentionally excluded; run npm run db:auth:ensure:local after db reset.",
    "",
    "BEGIN;",
    "",
    "TRUNCATE TABLE",
    ...(racePhotoNotes ? ["  public.race_photo_notes,"] : []),
    ...(racePhotos ? ["  public.race_photos,"] : []),
    ...(legResultObservations ? ["  public.leg_result_observations,"] : []),
    "  public.race_participations,",
    "  public.results,",
    "  public.placements,",
    "  public.leg_definitions,",
    "  public.runners",
    "RESTART IDENTITY CASCADE;",
    "",
    renderValuesInsert(
      "public.runners",
      ["email", "name"],
      runners.map((runner) => [normalizeEmail(runner.email) || null, runner.name])
    ),
    "",
    renderValuesInsert(
      "public.leg_definitions",
      ["number", "version", "distance", "elevation_gain"],
      legDefinitions
        .slice()
        .sort((a, b) => a.number - b.number || a.version - b.version)
        .map((leg) => [leg.number, leg.version, leg.distance, leg.elevation_gain])
    ),
    "",
    renderValuesInsert(
      "public.placements",
      [
        "year",
        "division",
        "division_place",
        "division_teams",
        "overall_place",
        "overall_teams",
        "bib",
        "notes",
        "race_start_time",
      ],
      placements
        .slice()
        .sort((a, b) => a.year - b.year)
        .map((placement) => [
          placement.year,
          placement.division,
          placement.division_place,
          placement.division_teams,
          placement.overall_place,
          placement.overall_teams,
          placement.bib,
          placement.notes,
          placement.race_start_time || (placement.year === 2024 ? "06:00:00" : "07:00:00"),
        ])
    ),
    "",
    ...(legResultObservations ? [renderLegResultObservationsInsert(legResultObservations, runnerById), ""] : []),
    renderResultsInsert(results, runnerById),
    "",
    renderRaceParticipationsInsert(raceParticipations, runnerById),
    "",
    ...(racePhotos ? [renderRacePhotosInsert(racePhotos), ""] : []),
    ...(racePhotoNotes ? [renderRacePhotoNotesInsert(racePhotoNotes, racePhotoById), ""] : []),
    "COMMIT;",
    "",
  ];

  return lines.join("\n");
}

function renderRacePhotoNotesInsert(racePhotoNotes, racePhotoById) {
  if (racePhotoNotes.length === 0) {
    return "-- No rows for public.race_photo_notes.";
  }

  const rows = racePhotoNotes
    .slice()
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((note) => {
      const photo = racePhotoById.get(note.photo_id);

      return [
        photo.storage_bucket,
        photo.storage_path,
        note.body,
        note.created_at,
        note.updated_at,
      ];
    });

  return [
    "INSERT INTO public.race_photo_notes (photo_id, body, created_at, updated_at)",
    "SELECT race_photos.id, seed.body, seed.created_at::timestamptz, seed.updated_at::timestamptz",
    "FROM (VALUES",
    rows.map((row) => `  (${row.map(sqlValue).join(", ")})`).join(",\n"),
    ") AS seed(storage_bucket, storage_path, body, created_at, updated_at)",
    "JOIN public.race_photos",
    "  ON race_photos.storage_bucket = seed.storage_bucket",
    " AND race_photos.storage_path = seed.storage_path;",
  ].join("\n");
}

function renderRacePhotosInsert(racePhotos) {
  if (racePhotos.length === 0) {
    return "-- No rows for public.race_photos.";
  }

  const columns = [
    "storage_bucket",
    "storage_path",
    "year",
    "event_name",
    "race",
    "caption",
    "alt_text",
    "category",
    "tags",
    "taken_on",
    "sort_order",
    "featured",
    "source",
    "original_filename",
    "width",
    "height",
    "size_bytes",
    "content_type",
  ];

  const rows = racePhotos
    .slice()
    .sort(
      (a, b) =>
        a.year - b.year ||
        a.sort_order - b.sort_order ||
        a.storage_path.localeCompare(b.storage_path)
    )
    .map((photo) => [
      sqlValue(photo.storage_bucket),
      sqlValue(photo.storage_path),
      sqlValue(photo.year),
      sqlValue(photo.event_name),
      sqlValue(photo.race),
      sqlValue(photo.caption),
      sqlValue(photo.alt_text),
      sqlValue(photo.category),
      sqlTextArray(photo.tags),
      sqlValue(photo.taken_on),
      sqlValue(photo.sort_order),
      sqlValue(photo.featured),
      sqlValue(photo.source),
      sqlValue(photo.original_filename),
      sqlValue(photo.width),
      sqlValue(photo.height),
      sqlValue(photo.size_bytes),
      sqlValue(photo.content_type),
    ]);

  return [
    `INSERT INTO public.race_photos (${columns.join(", ")}) VALUES`,
    rows.map((row) => `  (${row.join(", ")})`).join(",\n"),
    "ON CONFLICT (storage_bucket, storage_path) DO UPDATE",
    "SET year = EXCLUDED.year,",
    "    event_name = EXCLUDED.event_name,",
    "    race = EXCLUDED.race,",
    "    caption = EXCLUDED.caption,",
    "    alt_text = EXCLUDED.alt_text,",
    "    category = EXCLUDED.category,",
    "    tags = EXCLUDED.tags,",
    "    taken_on = EXCLUDED.taken_on,",
    "    sort_order = EXCLUDED.sort_order,",
    "    featured = EXCLUDED.featured,",
    "    source = EXCLUDED.source,",
    "    original_filename = EXCLUDED.original_filename,",
    "    width = EXCLUDED.width,",
    "    height = EXCLUDED.height,",
    "    size_bytes = EXCLUDED.size_bytes,",
    "    content_type = EXCLUDED.content_type,",
    "    updated_at = now();",
  ].join("\n");
}

function renderValuesInsert(table, columns, rows) {
  if (rows.length === 0) {
    return `-- No rows for ${table}.`;
  }

  return [
    `INSERT INTO ${table} (${columns.join(", ")}) VALUES`,
    rows.map((row) => `  (${row.map(sqlValue).join(", ")})`).join(",\n") + ";",
  ].join("\n");
}

function renderLegResultObservationsInsert(legResultObservations, runnerById) {
  if (legResultObservations.length === 0) {
    return "-- No rows for public.leg_result_observations.";
  }

  const rows = legResultObservations
    .slice()
    .sort((a, b) => {
      const runnerA = runnerById.get(a.runner_id)?.name || "";
      const runnerB = runnerById.get(b.runner_id)?.name || "";
      return (
        a.year - b.year ||
        a.leg_number - b.leg_number ||
        a.leg_version - b.leg_version ||
        runnerA.localeCompare(runnerB) ||
        a.source_type.localeCompare(b.source_type)
      );
    })
    .map((observation) => {
      const runner = observation.runner_id ? runnerById.get(observation.runner_id) : null;
      const submittedBy = observation.submitted_by_runner_id
        ? runnerById.get(observation.submitted_by_runner_id)
        : null;

      return [
        observation.id,
        observation.year,
        observation.leg_number,
        observation.leg_version,
        runner?.name ?? null,
        observation.source_type,
        observation.source_label,
        submittedBy?.name ?? null,
        sqlInterval(observation.lap_time),
        sqlInterval(observation.moving_time),
        sqlInterval(observation.elapsed_time),
        observation.distance,
        observation.elevation_gain,
        observation.notes,
        sqlJsonb(observation.raw_metadata),
      ];
    });

  return [
    "INSERT INTO public.leg_result_observations (",
    "  id, year, leg_number, leg_version, runner_id, source_type, source_label,",
    "  submitted_by_runner_id, lap_time, moving_time, elapsed_time, distance,",
    "  elevation_gain, notes, raw_metadata",
    ")",
    "SELECT seed.id::uuid, seed.year, seed.leg_number, seed.leg_version, runners.id,",
    "  seed.source_type, seed.source_label, submitted_by.id, seed.lap_time,",
    "  seed.moving_time, seed.elapsed_time, seed.distance, seed.elevation_gain,",
    "  seed.notes, seed.raw_metadata",
    "FROM (VALUES",
    rows
      .map((row) => {
        const [
          id,
          year,
          legNumber,
          legVersion,
          runnerName,
          sourceType,
          sourceLabel,
          submittedByName,
          lapTime,
          movingTime,
          elapsedTime,
          distance,
          elevationGain,
          notes,
          rawMetadata,
        ] = row;

        return `  (${[
          sqlValue(id),
          year,
          legNumber,
          legVersion,
          sqlValue(runnerName),
          sqlValue(sourceType),
          sqlValue(sourceLabel),
          sqlValue(submittedByName),
          lapTime,
          movingTime,
          elapsedTime,
          sqlValue(distance),
          sqlValue(elevationGain),
          sqlValue(notes),
          rawMetadata,
        ].join(", ")})`;
      })
      .join(",\n"),
    ") AS seed(",
    "  id, year, leg_number, leg_version, runner_name, source_type, source_label,",
    "  submitted_by_runner_name, lap_time, moving_time, elapsed_time, distance,",
    "  elevation_gain, notes, raw_metadata",
    ")",
    "LEFT JOIN public.runners ON public.runners.name = seed.runner_name",
    "LEFT JOIN public.runners submitted_by ON submitted_by.name = seed.submitted_by_runner_name;",
  ].join("\n");
}

function renderResultsInsert(results, runnerById) {
  if (results.length === 0) {
    return "-- No rows for public.results.";
  }

  const rows = results
    .slice()
    .sort((a, b) => a.year - b.year || a.leg_number - b.leg_number)
    .map((result) => {
      const runner = result.user_id ? runnerById.get(result.user_id) : null;
      const runnerRef = runner
        ? `(SELECT id FROM public.runners WHERE name = ${sqlValue(runner.name)})`
        : "NULL";

      return [
        result.year,
        result.leg_number,
        result.leg_version,
        runnerRef,
        sqlInterval(result.lap_time),
        sqlValue(result.notes),
        sqlValue(result.source_type || "official"),
        sqlValue(result.canonical_observation_id),
      ];
    });

  return [
    "INSERT INTO public.results (year, leg_number, leg_version, user_id, lap_time, notes, source_type, canonical_observation_id) VALUES",
    rows
      .map(([year, legNumber, legVersion, runnerRef, lapTime, notes, sourceType, canonicalObservationId]) =>
        `  (${year}, ${legNumber}, ${legVersion}, ${runnerRef}, ${lapTime}, ${notes}, ${sourceType}, ${canonicalObservationId})`
      )
      .join(",\n") + ";",
  ].join("\n");
}

function renderRaceParticipationsInsert(raceParticipations, runnerById) {
  if (raceParticipations.length === 0) {
    return "-- No rows for public.race_participations.";
  }

  const rows = raceParticipations
    .slice()
    .sort((a, b) => {
      const runnerA = runnerById.get(a.runner_id)?.name || "";
      const runnerB = runnerById.get(b.runner_id)?.name || "";
      return a.year - b.year || runnerA.localeCompare(runnerB);
    })
    .map((participation) => {
      const runner = runnerById.get(participation.runner_id);

      return [
        participation.year,
        runner.name,
        participation.status,
        participation.notes,
      ];
    });

  return [
    "INSERT INTO public.race_participations (year, runner_id, status, notes)",
    "SELECT seed.year, runners.id, seed.status, seed.notes",
    "FROM (VALUES",
    rows
      .map((row) => `  (${row.map(sqlValue).join(", ")})`)
      .join(",\n"),
    ") AS seed(year, runner_name, status, notes)",
    "JOIN public.runners ON public.runners.name = seed.runner_name",
    "ON CONFLICT (year, runner_id) DO UPDATE",
    "SET status = EXCLUDED.status,",
    "    notes = EXCLUDED.notes,",
    "    updated_at = now();",
  ].join("\n");
}

function assertUniqueRunnerNames(runners) {
  const seen = new Set();

  for (const runner of runners) {
    if (seen.has(runner.name)) {
      throw new Error(`Cannot generate seed with duplicate runner name: ${runner.name}`);
    }

    seen.add(runner.name);
  }
}

function assertKnownRunnerReferences(rows, key, runnerById, table) {
  for (const row of rows) {
    if (row[key] && !runnerById.has(row[key])) {
      throw new Error(`${table} references unknown runner id ${row[key]}`);
    }
  }
}

function assertKnownPhotoReferences(racePhotoNotes, racePhotoById) {
  for (const note of racePhotoNotes) {
    if (!racePhotoById.has(note.photo_id)) {
      throw new Error(`race_photo_notes references unknown photo id ${note.photo_id}`);
    }
  }
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function sqlValue(value) {
  if (value === null || value === undefined || value === "") {
    return "NULL";
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "NULL";
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  return `'${String(value).replaceAll("'", "''")}'`;
}

function sqlTextArray(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return "'{}'::text[]";
  }

  return `ARRAY[${values.map(sqlValue).join(", ")}]::text[]`;
}

function sqlInterval(value) {
  if (value === null || value === undefined || value === "") {
    return "NULL";
  }

  return `INTERVAL ${sqlValue(value)}`;
}

function sqlJsonb(value) {
  if (value === null || value === undefined) {
    return "'{}'::jsonb";
  }

  return `${sqlValue(JSON.stringify(value))}::jsonb`;
}

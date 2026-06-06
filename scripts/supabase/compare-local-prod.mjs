import { createClient } from "@supabase/supabase-js";
import { resolveSupabaseTarget } from "./target.mjs";

const [localTarget, prodTarget] = await Promise.all([
  resolveSupabaseTarget({ mode: "local" }),
  resolveSupabaseTarget({ mode: "prod" }),
]);

const [localSnapshot, prodSnapshot] = await Promise.all([
  snapshot(localTarget),
  snapshot(prodTarget),
]);

const differences = [];

for (const key of Object.keys(localSnapshot)) {
  const localJson = stableJson(localSnapshot[key]);
  const prodJson = stableJson(prodSnapshot[key]);

  if (localJson !== prodJson) {
    differences.push(key);
  }
}

console.log(`Compared local (${localTarget.projectRef}) with prod (${prodTarget.projectRef}).`);
console.log(
  [
    `runners=${localSnapshot.runners.length}`,
    `legs=${localSnapshot.legDefinitions.length}`,
    `placements=${localSnapshot.placements.length}`,
    `results=${localSnapshot.results.length}`,
    `observations=${localSnapshot.legResultObservations.length}`,
    `participations=${localSnapshot.raceParticipations.length}`,
    `comments=${localSnapshot.comments.length}`,
    `photos=${localSnapshot.racePhotos.length}`,
    `photoNotes=${localSnapshot.racePhotoNotes.length}`,
    `authEmails=${localSnapshot.authEmails.length}`,
  ].join(" ")
);

if (differences.length > 0) {
  console.error(`Mismatched sections: ${differences.join(", ")}`);
  process.exit(1);
}

console.log("Local and prod semantic data match.");

async function snapshot(target) {
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
    results,
    raceParticipations,
    legResultObservations,
    comments,
    racePhotos,
    racePhotoNotes,
  ] = await Promise.all([
    fetchAll(client, "runners", "id,name,email,auth_user_id", "name"),
    fetchAll(client, "leg_definitions", "number,version,distance,elevation_gain,official_course_url,map_embed_url", "number"),
    fetchPlacements(client),
    fetchAll(client, "results", "year,leg_number,leg_version,lap_time,user_id,source_type,canonical_observation_id", "year"),
    fetchAll(client, "race_participations", "year,runner_id,status,notes", "year"),
    fetchOptionalAll(
      client,
      "leg_result_observations",
      "id,year,leg_number,leg_version,runner_id,source_type,source_label,source_tags,submitted_by_runner_id,lap_time,moving_time,elapsed_time,distance,elevation_gain,raw_metadata,created_at,updated_at",
      "year"
    ),
    fetchOptionalAll(
      client,
      "comments",
      "id,target_type,year,leg_number,leg_version,runner_id,body,created_at,updated_at",
      "created_at"
    ),
    fetchOptionalAll(
      client,
      "race_photos",
      "id,storage_bucket,storage_path,year,event_name,race,caption,alt_text,category,tags,taken_on,sort_order,featured,source,original_filename,width,height,size_bytes,content_type",
      "year"
    ),
    fetchOptionalAll(
      client,
      "race_photo_notes",
      "photo_id,body,created_at,updated_at",
      "created_at"
    ),
  ]);

  const runnerById = new Map(runners.map((runner) => [runner.id, runner]));
  const racePhotoById = new Map(racePhotos.map((photo) => [photo.id, photo]));
  const runnerEmails = runners
    .map((runner) => normalizeEmail(runner.email))
    .filter(Boolean)
    .sort();

  return {
    runners: runners.map((runner) => ({
      name: runner.name,
      email: normalizeEmail(runner.email) || null,
      hasAuthLink: Boolean(runner.auth_user_id),
    })),
    legDefinitions: legDefinitions
      .slice()
      .sort((a, b) => a.number - b.number || a.version - b.version),
    placements: placements.slice().sort((a, b) => a.year - b.year),
    results: results
      .map((result) => ({
        year: result.year,
        leg_number: result.leg_number,
        leg_version: result.leg_version,
        runner_name: result.user_id ? runnerById.get(result.user_id)?.name || null : null,
        lap_time: result.lap_time,
        source_type: result.source_type,
        canonical_observation_id: result.canonical_observation_id,
      }))
      .sort((a, b) => a.year - b.year || a.leg_number - b.leg_number),
    raceParticipations: raceParticipations
      .map((participation) => ({
        year: participation.year,
        runner_name: runnerById.get(participation.runner_id)?.name || null,
        status: participation.status,
        notes: participation.notes,
      }))
      .sort((a, b) => a.year - b.year || a.runner_name.localeCompare(b.runner_name)),
    legResultObservations: legResultObservations
      .map((observation) => ({
        id: observation.id,
        year: observation.year,
        leg_number: observation.leg_number,
        leg_version: observation.leg_version,
        runner_name: observation.runner_id ? runnerById.get(observation.runner_id)?.name || null : null,
        source_type: observation.source_type,
        source_label: observation.source_label,
        source_tags: sortStrings(observation.source_tags),
        submitted_by_runner_name: observation.submitted_by_runner_id
          ? runnerById.get(observation.submitted_by_runner_id)?.name || null
          : null,
        lap_time: observation.lap_time,
        moving_time: observation.moving_time,
        elapsed_time: observation.elapsed_time,
        distance: observation.distance,
        elevation_gain: observation.elevation_gain,
        raw_metadata: observation.raw_metadata,
        created_at: observation.created_at,
        updated_at: observation.updated_at,
      }))
      .sort((a, b) => a.year - b.year || a.leg_number - b.leg_number || a.id.localeCompare(b.id)),
    comments: comments
      .map((comment) => ({
        id: comment.id,
        target_type: comment.target_type,
        year: comment.year,
        leg_number: comment.leg_number,
        leg_version: comment.leg_version,
        runner_name: comment.runner_id ? runnerById.get(comment.runner_id)?.name || null : null,
        body: comment.body,
        created_at: comment.created_at,
        updated_at: comment.updated_at,
      }))
      .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)),
    racePhotos: racePhotos
      .map((photo) => ({
        storage_bucket: photo.storage_bucket,
        storage_path: photo.storage_path,
        year: photo.year,
        event_name: photo.event_name,
        race: photo.race,
        caption: photo.caption,
        alt_text: photo.alt_text,
        category: photo.category,
        tags: sortStrings(photo.tags),
        taken_on: photo.taken_on,
        sort_order: photo.sort_order,
        featured: photo.featured,
        source: photo.source,
        original_filename: photo.original_filename,
        width: photo.width,
        height: photo.height,
        size_bytes: photo.size_bytes,
        content_type: photo.content_type,
      }))
      .sort((a, b) => a.storage_bucket.localeCompare(b.storage_bucket) || a.storage_path.localeCompare(b.storage_path)),
    racePhotoNotes: racePhotoNotes
      .map((note) => {
        const photo = racePhotoById.get(note.photo_id);

        return {
          storage_bucket: photo?.storage_bucket ?? null,
          storage_path: photo?.storage_path ?? null,
          body: note.body,
          created_at: note.created_at,
          updated_at: note.updated_at,
        };
      })
      .sort((a, b) =>
        String(a.storage_path).localeCompare(String(b.storage_path)) ||
        a.created_at.localeCompare(b.created_at)
      ),
    authEmails: await listRunnerAuthEmails(client, runnerEmails),
  };
}

async function fetchAll(client, table, columns, orderColumn) {
  const pageSize = 1000;
  const rows = [];

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await client
      .from(table)
      .select(columns)
      .order(orderColumn, { ascending: true })
      .range(from, from + pageSize - 1);

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

async function fetchOptionalAll(client, table, columns, orderColumn) {
  try {
    return await fetchAll(client, table, columns, orderColumn);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes(`Could not find the table 'public.${table}'`)
    ) {
      return [];
    }

    throw error;
  }
}

async function fetchPlacements(client) {
  try {
    return await fetchAll(
      client,
      "placements",
      "year,division,division_place,division_teams,overall_place,overall_teams,bib,race_start_time",
      "year"
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("Could not find the 'race_start_time' column")
    ) {
      const rows = await fetchAll(
        client,
        "placements",
        "year,division,division_place,division_teams,overall_place,overall_teams,bib",
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

async function listRunnerAuthEmails(client, runnerEmails) {
  const runnerEmailSet = new Set(runnerEmails);
  const authEmails = [];
  let page = 1;

  while (true) {
    const { data, error } = await client.auth.admin.listUsers({
      page,
      perPage: 1000,
    });

    if (error) {
      throw error;
    }

    for (const user of data.users || []) {
      const email = normalizeEmail(user.email);

      if (runnerEmailSet.has(email)) {
        authEmails.push(email);
      }
    }

    if (!data.users || data.users.length < 1000) {
      break;
    }

    page += 1;
  }

  return authEmails.sort();
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function sortStrings(values) {
  return Array.isArray(values) ? values.slice().sort((a, b) => String(a).localeCompare(String(b))) : [];
}

function stableJson(value) {
  return JSON.stringify(sortObjectKeys(value));
}

function sortObjectKeys(value) {
  if (Array.isArray(value)) {
    return value.map(sortObjectKeys);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, nestedValue]) => [key, sortObjectKeys(nestedValue)])
    );
  }

  return value;
}

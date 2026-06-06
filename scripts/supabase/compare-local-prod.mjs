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
    `participations=${localSnapshot.raceParticipations.length}`,
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
  ] = await Promise.all([
    fetchAll(client, "runners", "id,name,email,auth_user_id", "name"),
    fetchAll(client, "leg_definitions", "number,version,distance,elevation_gain", "number"),
    fetchAll(
      client,
      "placements",
      "year,division,division_place,division_teams,overall_place,overall_teams,bib,notes",
      "year"
    ),
    fetchAll(client, "results", "year,leg_number,leg_version,lap_time,user_id,notes", "year"),
    fetchAll(client, "race_participations", "year,runner_id,status,notes", "year"),
  ]);

  const runnerById = new Map(runners.map((runner) => [runner.id, runner]));
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
        notes: result.notes,
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

function stableJson(value) {
  return JSON.stringify(value);
}

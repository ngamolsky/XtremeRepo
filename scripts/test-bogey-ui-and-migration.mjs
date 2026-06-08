import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
assert.equal(
  packageJson.scripts["test:bogey-events"],
  "node scripts/test-bogey-events.mjs",
  "package.json should expose focused bogey event regression test"
);

const migrationNames = readdirSync("supabase/migrations").filter((name) => name.endsWith(".sql"));
const bogeyMigrationNames = migrationNames.filter(
  (name) => name.includes("bogey") || name.includes("partial_official") || name.includes("prefer_2022")
);
assert.ok(bogeyMigrationNames.length > 0, "Supabase migrations should introduce bogey event support");
const bogeyMigration = bogeyMigrationNames
  .map((name) => readFileSync(path.join("supabase/migrations", name), "utf8"))
  .join("\n");

assert.match(
  bogeyMigration,
  /ALTER TABLE public\.historical_team_results[\s\S]*start_offset_seconds/,
  "historical team results should store optional per-team start offsets"
);
assert.match(
  bogeyMigration,
  /CREATE OR REPLACE VIEW public\.v_bogey_events/,
  "migration should expose v_bogey_events"
);
assert.match(
  bogeyMigration,
  /our_team_result_links/,
  "bogey events should anchor on reviewed/linked Xtreme team rows"
);
assert.match(
  bogeyMigration,
  /historical_leg_splits/,
  "bogey events should use official source leg splits from all teams"
);
assert.match(
  bogeyMigration,
  /start_offset_seconds \+ elapsed_before_seconds|elapsed_before_seconds \+ start_offset_seconds/,
  "bogey calculation should use start offsets when present"
);
assert.match(
  bogeyMigration,
  /same_start_assumed/,
  "bogey calculation should label missing offsets as same-start assumed"
);
assert.match(
  bogeyMigration,
  /passed_by_us/,
  "bogey events should include teams we passed"
);
assert.match(
  bogeyMigration,
  /passed_us/,
  "bogey events should include teams that passed us"
);
assert.match(
  bogeyMigration,
  /our_before_position_seconds >= other_before_position_seconds/,
  "bogey calculation should count leg-1/tied-start passes instead of requiring a prior deficit"
);
assert.match(
  bogeyMigration,
  /our_before_position_seconds <= other_before_position_seconds/,
  "bogey calculation should count leg-1/tied-start passed-by events instead of requiring a prior lead"
);
assert.match(
  bogeyMigration,
  /representative_team_results/,
  "bogey calculation should de-duplicate duplicate extracted ranking-section rows"
);
assert.match(
  bogeyMigration,
  /positive_split_count > 0/,
  "bogey calculation should support official partial split rows instead of requiring seven complete legs"
);
assert.match(
  bogeyMigration,
  /2022 official spreadsheet partial split support for bogeys/,
  "migration should backfill 2022 partial spreadsheet splits for bogey calculations"
);
assert.match(
  bogeyMigration,
  /prefer the official spreadsheet's explicit partial split availability/,
  "migration should prefer 2022 spreadsheet dash/missing split availability over curated canonical split backfills"
);
assert.doesNotMatch(
  bogeyMigration,
  /division\s*=/i,
  "bogey events should not split or filter by division by default"
);

const relayDataSource = readFileSync("src/hooks/useRelayData.ts", "utf8");
assert.match(relayDataSource, /bogeyEvents/, "relay data should expose bogeyEvents");
assert.match(relayDataSource, /v_bogey_events/, "relay data should fetch v_bogey_events");
assert.match(relayDataSource, /readOptionalRows[\s\S]*v_bogey_events/, "bogey events should be optional until migration reaches prod");

const runnerSource = readFileSync("src/components/RunnerDetail.tsx", "utf8");
assert.match(runnerSource, /Bogeys/, "runner page should display bogey stats");
assert.match(runnerSource, /buildRunnerBogeySummary/, "runner page should summarize bogeys with the shared helper");
assert.match(runnerSource, /same-start inferred/i, "runner page should label same-start inferred bogeys honestly");

const runSource = readFileSync("src/components/RunInstanceDetail.tsx", "utf8");
assert.match(runSource, /Bogeys/, "leg performance page should display bogeys for that leg");
assert.match(runSource, /filterBogeyEventsForPerformance/, "leg performance page should use the shared helper to filter bogey events");
assert.match(runSource, /Start-wave differences may affect inferred physical passes/, "leg performance page should explain start-wave uncertainty");

const workerSource = readFileSync("src/worker/index.ts", "utf8");
assert.match(workerSource, /v_bogey_events/, "Falco worker should be aware of v_bogey_events");
assert.match(workerSource, /bogey/i, "Falco prompt/tool context should describe bogey semantics");
assert.match(workerSource, /same-start inferred/i, "Falco should label missing start offsets as same-start inferred");

const bogeyNotes = readFileSync("docs/bogey-source-data-notes.md", "utf8");
assert.match(bogeyNotes, /2022 Xtreme Falcons/, "repo should document the 2022 canonical source mismatch");
assert.match(bogeyNotes, /spreadsheet's available split values as canonical/, "repo should document source-spreadsheet precedence for 2022 bogeys");

console.log("bogey UI and migration tests passed");

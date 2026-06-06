import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const helperPath = new URL("../src/lib/runnerRaceBreakdown.ts", import.meta.url);
assert.ok(existsSync(helperPath), "src/lib/runnerRaceBreakdown.ts should exist");

const source = readFileSync(helperPath, "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    esModuleInterop: true,
  },
}).outputText;

const sandbox = {
  exports: {},
  module: { exports: {} },
  require(specifier) {
    throw new Error(`Unexpected runtime require: ${specifier}`);
  },
};
sandbox.exports = sandbox.module.exports;
vm.runInNewContext(compiled, sandbox, { filename: "runnerRaceBreakdown.cjs" });

const { buildRunnerRaceBreakdown } = sandbox.module.exports;

const officialResults = [
  {
    year: 2026,
    leg_number: 3,
    leg_version: 2,
    runner_name: "Nikita",
    runner_id: "runner-nikita",
    lap_time: "00:42:00",
    pace: 8.4,
    distance: 5,
    elevation_gain: 300,
    source_type: "official",
  },
  {
    year: 2025,
    leg_number: 1,
    leg_version: 1,
    runner_name: "Nikita",
    runner_id: "runner-nikita",
    lap_time: "00:50:00",
    pace: 10,
    distance: 5,
    elevation_gain: 100,
    source_type: "official",
  },
  {
    year: 2026,
    leg_number: 4,
    leg_version: 2,
    runner_name: "Other Runner",
    runner_id: "runner-other",
    lap_time: "00:44:00",
    pace: 8.8,
    distance: 5,
    elevation_gain: 200,
    source_type: "official",
  },
];

const observations = [
  {
    id: "provisional-same-race",
    year: 2026,
    leg_number: 3,
    leg_version: 2,
    runner_name: "Nikita",
    runner_id: "runner-nikita",
    source_type: "strava",
    source_label: "Garmin race watch",
    source_tags: ["watch"],
    lap_time: null,
    elapsed_time: "00:43:15",
    moving_time: null,
    primary_time: "00:43:15",
    primary_time_type: "elapsed_time",
    pace: null,
    observed_distance: null,
    observed_elevation_gain: null,
    display_distance: 5.1,
    display_elevation_gain: 310,
    canonical_distance: 5.1,
    canonical_elevation_gain: 310,
    updated_at: "2026-06-06T17:10:00.000Z",
    created_at: "2026-06-06T17:05:00.000Z",
  },
  {
    id: "provisional-only-race",
    year: 2024,
    leg_number: 7,
    leg_version: 1,
    runner_name: "Nikita",
    runner_id: "runner-nikita",
    source_type: "manual_admin",
    source_label: "finish line note",
    source_tags: [],
    lap_time: "00:49:00",
    elapsed_time: null,
    moving_time: null,
    primary_time: "00:49:00",
    primary_time_type: "lap_time",
    pace: 9.8,
    observed_distance: 5,
    observed_elevation_gain: 250,
    display_distance: 5,
    display_elevation_gain: 250,
    canonical_distance: 5,
    canonical_elevation_gain: 250,
    updated_at: "2024-06-06T17:00:00.000Z",
    created_at: "2024-06-06T17:00:00.000Z",
  },
  {
    id: "other-runner-observation",
    year: 2026,
    leg_number: 5,
    leg_version: 2,
    runner_name: "Other Runner",
    runner_id: "runner-other",
    source_type: "manual_admin",
    source_label: "not Nikita",
    source_tags: [],
    lap_time: "00:45:00",
    primary_time: "00:45:00",
    primary_time_type: "lap_time",
    elapsed_time: null,
    moving_time: null,
    pace: 9,
    observed_distance: 5,
    observed_elevation_gain: 250,
    display_distance: 5,
    display_elevation_gain: 250,
    canonical_distance: 5,
    canonical_elevation_gain: 250,
    updated_at: "2026-06-06T17:00:00.000Z",
    created_at: "2026-06-06T17:00:00.000Z",
  },
];

const races = buildRunnerRaceBreakdown("Nikita", officialResults, observations);

assert.deepEqual(
  JSON.parse(JSON.stringify(races.map((race) => race.year))),
  [2026, 2025, 2024],
  "runner race groups should include official-only, mixed, and provisional-only races newest first"
);

const mixedRace = races[0];
assert.equal(mixedRace.official.length, 1, "mixed race should keep official result");
assert.equal(mixedRace.provisional.length, 1, "mixed race should also show provisional result for the same race");
assert.equal(mixedRace.official[0].label, "Leg 3 (v2)");
assert.equal(mixedRace.provisional[0].label, "Leg 3 (v2)");
assert.equal(mixedRace.provisional[0].timeLabel, "Elapsed");
assert.equal(mixedRace.provisional[0].sourceLabel, "Garmin race watch");
assert.deepEqual(JSON.parse(JSON.stringify(mixedRace.provisional[0].assumedMetrics)), {
  pace: true,
  distance: true,
  elevationGain: true,
});

const provisionalOnlyRace = races[2];
assert.equal(provisionalOnlyRace.official.length, 0, "provisional-only race should not invent official rows");
assert.equal(provisionalOnlyRace.provisional.length, 1, "provisional-only race should be visible until official data exists");
assert.equal(provisionalOnlyRace.provisional[0].time, "00:49:00");

console.log("runner race breakdown tests passed");

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const raceDisplaySource = readFileSync(new URL("../src/lib/raceDisplay.ts", import.meta.url), "utf8");
const raceDetailSource = readFileSync(new URL("../src/components/RaceDetailView.tsx", import.meta.url), "utf8");
const compiled = ts.transpileModule(raceDisplaySource, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    esModuleInterop: true,
  },
}).outputText;

const gradeAdjustedPaceSource = readFileSync(new URL("../src/lib/gradeAdjustedPace.ts", import.meta.url), "utf8");
const gradeAdjustedPaceCompiled = ts.transpileModule(gradeAdjustedPaceSource, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    esModuleInterop: true,
  },
}).outputText;
const gradeAdjustedPaceModule = { exports: {} };
vm.runInNewContext(
  gradeAdjustedPaceCompiled,
  { exports: gradeAdjustedPaceModule.exports, module: gradeAdjustedPaceModule },
  { filename: "gradeAdjustedPace.cjs" }
);

const sandbox = {
  exports: {},
  module: { exports: {} },
  require(specifier) {
    if (specifier === "./gradeAdjustedPace") {
      return gradeAdjustedPaceModule.exports;
    }
    throw new Error(`Unexpected runtime require: ${specifier}`);
  },
};
sandbox.exports = sandbox.module.exports;
vm.runInNewContext(compiled, sandbox, { filename: "raceDisplay.cjs" });

const { getDisplayLegResults, getNaiveLiveProjection } = sandbox.module.exports;
assert.equal(typeof getNaiveLiveProjection, "function", "raceDisplay should export getNaiveLiveProjection");

const historicalOfficialResults = [
  { year: 2023, leg_number: 1, leg_version: 2, lap_time: "00:50:00" },
  { year: 2024, leg_number: 1, leg_version: 2, lap_time: "00:54:00" },
  { year: 2023, leg_number: 2, leg_version: 2, lap_time: "01:00:00" },
  { year: 2024, leg_number: 2, leg_version: 2, lap_time: "01:04:00" },
  { year: 2022, leg_number: 3, leg_version: 1, lap_time: "01:45:00" },
  { year: 2023, leg_number: 3, leg_version: 2, lap_time: "00:45:00" },
  { year: 2024, leg_number: 3, leg_version: 2, lap_time: "00:51:00" },
  { year: 2023, leg_number: 4, leg_version: 2, lap_time: "00:55:00" },
  { year: 2024, leg_number: 4, leg_version: 2, lap_time: "01:01:00" },
  { year: 2023, leg_number: 5, leg_version: 2, lap_time: "01:10:00" },
  { year: 2024, leg_number: 5, leg_version: 2, lap_time: "01:14:00" },
  { year: 2023, leg_number: 6, leg_version: 2, lap_time: "01:20:00" },
  { year: 2024, leg_number: 6, leg_version: 2, lap_time: "01:24:00" },
  { year: 2023, leg_number: 7, leg_version: 2, lap_time: "00:40:00" },
  { year: 2024, leg_number: 7, leg_version: 2, lap_time: "00:44:00" },
];
const legDefinitions = Array.from({ length: 7 }, (_, index) => ({
  number: index + 1,
  version: 2,
  distance: null,
  elevation_gain: null,
}));
const currentOfficialResults = [
  { year: 2026, leg_number: 1, leg_version: 2, lap_time: "00:49:00" },
];
const currentObservations = [
  {
    id: "obs-leg-2",
    year: 2026,
    leg_number: 2,
    leg_version: 2,
    runner_name: "Nikita",
    runner_id: "runner-nikita",
    source_type: "garmin",
    source_label: "watch",
    source_tags: ["race day"],
    lap_time: null,
    elapsed_time: null,
    moving_time: "00:58:00",
    primary_time: "00:58:00",
    primary_time_type: "moving_time",
    pace: null,
    observed_distance: null,
    observed_elevation_gain: null,
    display_distance: 6,
    display_elevation_gain: 700,
    updated_at: "2026-06-06T17:00:00.000Z",
    created_at: "2026-06-06T17:00:00.000Z",
  },
  {
    id: "distance-only-leg-3",
    year: 2026,
    leg_number: 3,
    leg_version: 2,
    runner_name: "Nick",
    runner_id: "runner-nick",
    source_type: "manual_admin",
    source_label: "distance only should not count completed",
    source_tags: [],
    lap_time: null,
    elapsed_time: null,
    moving_time: null,
    primary_time: null,
    primary_time_type: null,
    pace: null,
    observed_distance: 5.1,
    observed_elevation_gain: null,
    display_distance: 5.1,
    display_elevation_gain: 500,
    updated_at: "2026-06-06T18:00:00.000Z",
    created_at: "2026-06-06T18:00:00.000Z",
  },
];

const displayLegResults = getDisplayLegResults(2026, currentOfficialResults, currentObservations);
const projection = getNaiveLiveProjection(2026, displayLegResults, [...historicalOfficialResults, ...currentOfficialResults], legDefinitions);

assert.equal(projection.reportedLegCount, 2, "only official/current self recorded legs with a time should count as reported");
assert.equal(projection.estimatedLegCount, 5, "remaining legs should be estimated from historical averages");
assert.equal(projection.currentRecordedMinutes, 107, "current recorded time should sum reported legs only");
assert.equal(projection.projectedTotalMinutes, 409, "projection should add reported time plus historical average remaining legs");
assert.equal(projection.displayCurrentRecordedTime, "1:47:00");
assert.equal(projection.displayProjectedTotalTime, "6:49:00");
assert.deepEqual(
  JSON.parse(JSON.stringify(projection.legs.map((leg) => ({ legNumber: leg.legNumber, status: leg.status, timeSource: leg.timeSource, minutes: leg.minutes, sourceLabel: leg.sourceLabel })))),
  [
    { legNumber: 1, status: "reported", timeSource: "official", minutes: 49, sourceLabel: "Official" },
    { legNumber: 2, status: "reported", timeSource: "self_recorded", minutes: 58, sourceLabel: "Garmin · watch" },
    { legNumber: 3, status: "estimated", timeSource: "estimated", minutes: 48, sourceLabel: "Historical avg for leg 3 v2" },
    { legNumber: 4, status: "estimated", timeSource: "estimated", minutes: 58, sourceLabel: "Historical avg for leg 4 v2" },
    { legNumber: 5, status: "estimated", timeSource: "estimated", minutes: 72, sourceLabel: "Historical avg for leg 5 v2" },
    { legNumber: 6, status: "estimated", timeSource: "estimated", minutes: 82, sourceLabel: "Historical avg for leg 6 v2" },
    { legNumber: 7, status: "estimated", timeSource: "estimated", minutes: 42, sourceLabel: "Historical avg for leg 7 v2" },
  ]
);

const historicalOnlyProjection = getNaiveLiveProjection(
  2026,
  [],
  historicalOfficialResults,
  legDefinitions
);
assert.equal(historicalOnlyProjection.reportedLegCount, 0, "historical-only projection should support no reported legs");
assert.equal(historicalOnlyProjection.estimatedLegCount, 7, "historical-only projection should estimate every relay leg");
assert.equal(historicalOnlyProjection.displayProjectedTotalTime, "6:56:00", "historical-only projection should sum current-leg historical averages");

assert.match(raceDetailSource, /Live Projection/, "race detail should render a Live Projection card");
assert.match(raceDetailSource, /getNaiveLiveProjection/, "race detail should use the naive live projection helper");
assert.match(
  raceDetailSource,
  /Uses self recorded times for reported legs and historical leg averages for legs not yet reported\./,
  "live projection card should make the naive method explicit"
);
assert.match(raceDetailSource, /Projected total/, "live projection card should show projected total");
assert.match(raceDetailSource, /Current recorded time/, "live projection card should show current recorded time");
assert.match(raceDetailSource, /text-emerald-700 dark:text-emerald-300/, "official projection times should use light/dark-safe green text");
assert.match(raceDetailSource, /text-amber-700 dark:text-amber-300/, "self-reported projection times should use light/dark-safe amber text");
assert.match(raceDetailSource, /text-sky-700 dark:text-sky-300/, "estimated projection times should use light/dark-safe sky text");

console.log("race live projection tests passed");

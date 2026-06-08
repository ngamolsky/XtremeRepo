import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
assert.equal(
  packageJson.scripts["test:dashboard-self-reported"],
  "node scripts/test-dashboard-self-reported-results.mjs",
  "package.json should expose the dashboard self-reported regression test"
);

const helperPath = new URL("../src/lib/dashboardPerformance.ts", import.meta.url);
assert.ok(existsSync(helperPath), "src/lib/dashboardPerformance.ts should exist");

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
vm.runInNewContext(compiled, sandbox, { filename: "dashboardPerformance.cjs" });

const { buildDashboardPerformanceData } = sandbox.module.exports;
assert.equal(typeof buildDashboardPerformanceData, "function", "dashboard helper should export buildDashboardPerformanceData");

const yearlySummary = [
  {
    year: 2025,
    total_time: "11:30:00",
    average_pace: "9:30",
    overall_place: 20,
    overall_teams: 100,
    division_place: 3,
    division_teams: 20,
    division: "Mixed Open",
    overall_percentile: 20,
    division_percentile: 15,
  },
];

const results = [
  {
    year: 2025,
    leg_number: 1,
    leg_version: 1,
    runner_name: "Official Runner",
    lap_time: "00:45:00",
    time_in_minutes: 45,
    pace: 9,
  },
  {
    year: 2026,
    leg_number: 3,
    leg_version: 1,
    runner_name: "Official Leg Three",
    lap_time: "00:41:00",
    time_in_minutes: 41,
    pace: 8.2,
  },
];

const observations = [
  {
    id: "self-leg-1",
    year: 2026,
    leg_number: 1,
    leg_version: 1,
    runner_name: "Self Runner One",
    primary_time: "00:50:00",
    lap_time: null,
    elapsed_time: null,
    moving_time: null,
    time_in_minutes: 50,
    pace: 10,
    has_canonical_result: false,
  },
  {
    id: "self-leg-2",
    year: 2026,
    leg_number: 2,
    leg_version: 1,
    runner_name: "Self Runner Two",
    primary_time: "00:45:00",
    lap_time: null,
    elapsed_time: null,
    moving_time: null,
    time_in_minutes: 45,
    pace: 9,
    has_canonical_result: false,
  },
  {
    id: "self-leg-3-shadowed",
    year: 2026,
    leg_number: 3,
    leg_version: 1,
    runner_name: "Shadowed Self Runner",
    primary_time: "00:44:00",
    lap_time: null,
    elapsed_time: null,
    moving_time: null,
    time_in_minutes: 44,
    pace: 8.8,
    has_canonical_result: false,
  },
  {
    id: "canonical-observation-hidden",
    year: 2026,
    leg_number: 4,
    leg_version: 1,
    runner_name: "Canonical Observation",
    primary_time: "00:43:00",
    lap_time: null,
    elapsed_time: null,
    moving_time: null,
    time_in_minutes: 43,
    pace: 8.6,
    has_canonical_result: true,
  },
];

const dashboard = buildDashboardPerformanceData(yearlySummary, results, observations);

assert.equal(dashboard.currentYear, 2026, "dashboard should use newest self-reported race year when it is newer than official summaries");
assert.equal(dashboard.latestRaceEntries.length, 3, "latest race chart should include unshadowed self-reported legs plus official legs");
assert.deepEqual(
  JSON.parse(JSON.stringify(dashboard.latestRaceEntries.map((entry) => [entry.legNumber, entry.resultType]))),
  [
    [1, "self_reported"],
    [2, "self_reported"],
    [3, "official"],
  ],
  "official leg results should replace self-reported entries for the same leg/version"
);
assert.equal(dashboard.latestRaceEntries[0].runner, "Self Runner One");
assert.equal(dashboard.latestRaceEntries[0].label, "Self Reported");
assert.equal(dashboard.latestTime, "2:16:00", "latest time card should sum visible latest race official/self-reported leg times");
assert.equal(dashboard.latestTimeResultType, "self_reported", "latest time card should know when any visible latest-race time is self-reported");
assert.equal(dashboard.latestTimeSelfReportedLegCount, 2, "latest time card should expose how many visible legs are self-reported");
assert.equal(dashboard.totalRaces, 2, "total races should count provisional-only years alongside official years");

assert.deepEqual(
  JSON.parse(JSON.stringify(dashboard.yearlyRows.map((row) => [row.year, row.resultType, row.totalTime, row.selfReportedLegCount]))),
  [
    [2026, "self_reported", "2:16:00", 2],
    [2025, "official", "11:30:00", 0],
  ],
  "year-over-year table should include a labeled self-reported row until official yearly results exist"
);

const dashboardSource = readFileSync(new URL("../src/components/Dashboard.tsx", import.meta.url), "utf8");
assert.match(dashboardSource, /Self Reported/, "dashboard should label provisional values as Self Reported");
assert.match(dashboardSource, /bg-amber-100[^"]*text-amber-900[^"]*dark:bg-amber-950[^"]*dark:text-amber-100/, "Self Reported label should use readable amber classes in light and dark mode");
assert.match(dashboardSource, /label="Latest Time"[\s\S]*latestTimeResultType === "self_reported"[\s\S]*<SelfReportedBadge compact \/>/, "latest time stat card should show a Self Reported badge when latest time includes self-reported legs");
assert.match(dashboardSource, /SelfReportedDot[\s\S]*bg-amber-600[\s\S]*dark:bg-amber-300/, "latest race chart should include a dark/light-safe amber dot for self-reported times");
assert.doesNotMatch(dashboardSource, /Year-over-Year Performance[\s\S]{0,500}<SelfReportedBadge \/>/, "year-over-year section header should not label the whole table as self-reported");
assert.match(dashboardSource, /perf\.resultType === "self_reported" \? <SelfReportedBadge compact \/> : null/, "year-over-year table should label only self-reported rows");
assert.match(dashboardSource, /buildDashboardPerformanceData/, "dashboard component should use the shared dashboard performance helper");

console.log("dashboard self-reported results tests passed");

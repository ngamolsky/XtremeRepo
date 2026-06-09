import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const raceSummaryPath = new URL("../src/lib/raceSummary.ts", import.meta.url);
assert.equal(existsSync(raceSummaryPath), true, "race summary helper should exist");

const raceSummarySource = readFileSync(raceSummaryPath, "utf8");
const compiled = ts.transpileModule(raceSummarySource, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    esModuleInterop: true,
  },
}).outputText;
const sandbox = { exports: {}, module: { exports: {} } };
sandbox.exports = sandbox.module.exports;
vm.runInNewContext(compiled, sandbox, { filename: "raceSummary.cjs" });

const { getRacesTopSummary } = sandbox.module.exports;
assert.equal(typeof getRacesTopSummary, "function", "race summary helper should export getRacesTopSummary");

const summary = getRacesTopSummary([
  { year: 2021, total_time: "08:59:00", race_version: 1 },
  { year: 2023, total_time: "09:10:00", race_version: 2 },
  { year: 2024, total_time: "09:04:00", race_version: 2 },
  { year: 2025, total_time: "10:05:00", race_version: 2 },
  { year: 2026, total_time: null, race_version: 2 },
]);

assert.deepEqual(
  JSON.parse(JSON.stringify(summary)),
  {
    yearsRan: 5,
    latestRace: { year: 2026, time: null, hasOfficialTime: false },
    latestRaceWithTime: { year: 2025, time: "10:05:00" },
    currentRaceVersion: 2,
    bestCurrentCourseTime: { year: 2024, time: "09:04:00" },
  },
  "top summary should count race years, show the latest race shell even when official results are pending, keep latest timed race available, and filter best time to current race version"
);

const historySource = readFileSync(new URL("../src/components/HistoryView.tsx", import.meta.url), "utf8");
assert.match(historySource, /Years ran/, "Races top summary should label years ran exactly");
assert.match(historySource, /Latest race/, "Races top summary should include latest race");
assert.match(historySource, /official pending/, "Latest race should label race shells without official results as pending");
assert.match(historySource, /Best current-course time/, "Races top summary should include current-course best time");
assert.doesNotMatch(historySource, /Best Percentile/, "Races top summary should not include Best Percentile");
assert.doesNotMatch(historySource, /Avg Percentile/, "Races top summary should not include Avg Percentile");
assert.match(historySource, /getRacesTopSummary/, "Races page should use the shared top summary helper");

const schemaSource = readFileSync(new URL("../supabase/schemas/04_team_placements.sql", import.meta.url), "utf8");
const analyticsSchemaSource = readFileSync(new URL("../supabase/schemas/06_performance_analytics.sql", import.meta.url), "utf8");
assert.match(schemaSource, /"race_version" smallint DEFAULT 1 NOT NULL/, "placements schema should include a minimal race_version column");
assert.match(analyticsSchemaSource, /"p"\."race_version"/, "v_yearly_summary should expose race_version from placements");

const migrationSource = readFileSync(
  new URL("../supabase/migrations/20260608180224_add_race_version_to_placements.sql", import.meta.url),
  "utf8"
);
assert.match(migrationSource, /SET race_version = 2/, "migration should backfill race version 2 rows");
assert.match(migrationSource, /FROM public\.results r[\s\S]*r\.leg_version = 2/, "migration should use official result leg_version 2 boundary");
assert.match(migrationSource, /FROM public\.race_leg_assignments a[\s\S]*a\.leg_version = 2/, "migration should use assignment leg_version 2 boundary");

const routeTreeSource = readFileSync(new URL("../src/routeTree.gen.ts", import.meta.url), "utf8");
const routeSources = [
  readFileSync(new URL("../src/components/HistoryView.tsx", import.meta.url), "utf8"),
  readFileSync(new URL("../src/components/RaceDetailView.tsx", import.meta.url), "utf8"),
  readFileSync(new URL("../src/components/RunnerDetail.tsx", import.meta.url), "utf8"),
  readFileSync(new URL("../src/components/LegPill.tsx", import.meta.url), "utf8"),
  routeTreeSource,
].join("\n");

assert.doesNotMatch(routeSources, /\/legs\/\$legNumber\/\$version/, "public leg routes should not require leg version");
assert.doesNotMatch(routeSources, /\/runs\/\$runnerName\/\$year\/\$legNumber\/\$version/, "public performance routes should not require leg version");
assert.doesNotMatch(routeSources, /Leg \{[^}]+\} v\{[^}]+\}/, "page UI should not render visible leg version labels");

console.log("races top summary and version simplification tests passed");

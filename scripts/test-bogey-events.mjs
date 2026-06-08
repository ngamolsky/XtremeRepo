import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const helperPath = new URL("../src/lib/bogeyStats.ts", import.meta.url);
assert.ok(existsSync(helperPath), "src/lib/bogeyStats.ts should exist");

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
vm.runInNewContext(compiled, sandbox, { filename: "bogeyStats.cjs" });

const {
  buildRunnerBogeySummary,
  filterBogeyEventsForPerformance,
  formatBogeyEventSummary,
  formatBogeyScore,
} = sandbox.module.exports;

const events = [
  {
    year: 2026,
    runner_name: "Nikita",
    runner_id: "runner-nikita",
    leg_number: 2,
    leg_version: 1,
    event_type: "passed_by_us",
    other_team_name: "Team We Caught",
    other_bib: "42",
    time_basis: "same_start_assumed",
    start_offsets_known: false,
    seconds_swung: 90,
  },
  {
    year: 2026,
    runner_name: "Nikita",
    runner_id: "runner-nikita",
    leg_number: 2,
    leg_version: 1,
    event_type: "passed_us",
    other_team_name: "Team That Caught Us",
    other_bib: "13",
    time_basis: "known_start_offsets",
    start_offsets_known: true,
    seconds_swung: 120,
  },
  {
    year: 2025,
    runner_name: "Other Runner",
    runner_id: "runner-other",
    leg_number: 3,
    leg_version: 1,
    event_type: "passed_by_us",
    other_team_name: "Other Team",
    other_bib: "7",
    time_basis: "same_start_assumed",
    start_offsets_known: false,
    seconds_swung: 30,
  },
];

const summary = buildRunnerBogeySummary("Nikita", events);
assert.equal(summary.passedCount, 1, "runner summary should count teams the runner passed");
assert.equal(summary.passedByCount, 1, "runner summary should count teams that passed the runner");
assert.equal(summary.net, 0, "net bogeys should be passed minus passed-by");
assert.equal(formatBogeyScore(summary), "0 (+1 / -1)", "runner formatter should show net first, then positive/negative split");
assert.equal(summary.sameStartAssumedCount, 1, "summary should retain same-start assumption count");
assert.equal(summary.knownStartOffsetCount, 1, "summary should retain known-start-offset count");

const legEvents = filterBogeyEventsForPerformance(events, {
  runnerName: "Nikita",
  year: 2026,
  legNumber: 2,
  legVersion: 1,
});
assert.equal(legEvents.length, 2, "performance filter should return only events on the selected runner leg");
assert.equal(formatBogeyEventSummary(legEvents), "0 (+1 / -1)", "performance formatter should show net first, then passed and passed-by counts");
assert.equal(formatBogeyEventSummary([]), "0 (+0 / -0)", "empty performance formatter should return zero score with split counts");

console.log("bogey event helper tests passed");

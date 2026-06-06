import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../src/lib/raceDisplay.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
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

const { getDisplayLegResults } = sandbox.module.exports;

const rows = getDisplayLegResults(
  2026,
  [],
  [
    {
      id: "obs-without-measurements",
      year: 2026,
      leg_number: 7,
      leg_version: 2,
      runner_name: "Nick",
      runner_id: "runner-nick",
      source_type: "manual_admin",
      source_label: "race day note",
      source_tags: ["provisional"],
      lap_time: "00:48:00",
      elapsed_time: null,
      moving_time: null,
      primary_time: "00:48:00",
      pace: null,
      observed_distance: null,
      observed_elevation_gain: null,
      display_distance: 4.8,
      display_elevation_gain: 615,
      updated_at: "2026-06-06T17:00:00.000Z",
      created_at: "2026-06-06T17:00:00.000Z",
    },
  ]
);

assert.equal(rows.length, 1, "source-only provisional observation should still appear in race list");
assert.equal(rows[0].kind, "self_recorded");
assert.equal(rows[0].lap_time, "00:48:00");
assert.equal(rows[0].distance, 4.8, "missing provisional distance should fall back to canonical leg distance");
assert.equal(rows[0].elevation_gain, 615, "missing provisional elevation should fall back to canonical leg elevation");
assert.equal(rows[0].pace, 10, "missing provisional pace should use time divided by assumed distance");
assert.equal(
  Number(rows[0].gradeAdjustedPace?.toFixed(2)),
  8.71,
  "provisional grade adjusted pace should use the same assumed distance and elevation as pace display"
);
assert.deepEqual(JSON.parse(JSON.stringify(rows[0].assumed_metrics)), {
  pace: true,
  distance: true,
  elevationGain: true,
});

console.log("race display provisional metric tests passed");

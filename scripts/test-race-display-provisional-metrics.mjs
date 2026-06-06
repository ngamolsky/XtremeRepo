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

const sandbox = {
  exports: {},
  module: { exports: {} },
  require(specifier) {
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
      lap_time: null,
      elapsed_time: null,
      moving_time: null,
      primary_time: null,
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
assert.equal(rows[0].lap_time, null, "missing provisional time should render as N/A");
assert.equal(rows[0].distance, null, "missing provisional distance should render as N/A, not canonical leg distance");
assert.equal(rows[0].elevation_gain, null, "missing provisional elevation should render as N/A, not canonical leg elevation");

console.log("race display provisional metric tests passed");

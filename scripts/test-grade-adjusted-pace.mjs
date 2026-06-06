import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../src/lib/gradeAdjustedPace.ts", import.meta.url), "utf8");
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
};
sandbox.exports = sandbox.module.exports;
vm.runInNewContext(compiled, sandbox, { filename: "gradeAdjustedPace.cjs" });

const { getGradeAdjustedPace, formatGradeAdjustedPace } = sandbox.module.exports;

assert.equal(
  getGradeAdjustedPace({ pace: null, distanceMiles: 5, elevationGainFeet: 500 }),
  null,
  "missing pace should not produce grade adjusted pace"
);
assert.equal(
  getGradeAdjustedPace({ pace: 9, distanceMiles: null, elevationGainFeet: 500 }),
  null,
  "missing distance should not produce grade adjusted pace"
);
assert.equal(
  getGradeAdjustedPace({ pace: 9, distanceMiles: 5, elevationGainFeet: null }),
  null,
  "missing elevation should not produce grade adjusted pace"
);
assert.equal(
  getGradeAdjustedPace({ pace: 9, distanceMiles: 5, elevationGainFeet: 0 }),
  9,
  "flat legs should keep actual pace as grade adjusted pace"
);

const adjusted = getGradeAdjustedPace({
  pace: 10,
  distanceMiles: 5,
  elevationGainFeet: 500,
});
assert.ok(adjusted !== null, "climbing legs should produce an adjusted pace");
assert.equal(Number(adjusted.toFixed(2)), 8.98, "moderate climbing should normalize to faster flat-equivalent pace");
assert.equal(formatGradeAdjustedPace(adjusted), "8:59/mi", "formatted GAP should use pace formatting");

const extreme = getGradeAdjustedPace({ pace: 20, distanceMiles: 1, elevationGainFeet: 2500 });
assert.equal(Number(extreme?.toFixed(2)), 9.09, "very steep average grades should be clamped to avoid impossible corrections");

console.log("grade adjusted pace tests passed");

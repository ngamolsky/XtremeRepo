import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const helperPath = new URL("../src/lib/runnerLegRadar.ts", import.meta.url);
assert.ok(existsSync(helperPath), "src/lib/runnerLegRadar.ts should exist");

const source = readFileSync(helperPath, "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
    esModuleInterop: true,
  },
}).outputText;

const module = { exports: {} };
vm.runInNewContext(compiled, { exports: module.exports, module }, { filename: "runnerLegRadar.ts" });

const {
  buildLegRadarData,
  buildLegRadarVersionOptions,
  buildLatestLegRadarData,
  formatRadarPoints,
  radarPointForIndex,
} = module.exports;
assert.equal(typeof buildLatestLegRadarData, "function", "buildLatestLegRadarData should be exported");
assert.equal(typeof buildLegRadarData, "function", "buildLegRadarData should be exported");
assert.equal(
  typeof buildLegRadarVersionOptions,
  "function",
  "buildLegRadarVersionOptions should be exported"
);
assert.equal(typeof radarPointForIndex, "function", "radarPointForIndex should be exported");
assert.equal(typeof formatRadarPoints, "function", "formatRadarPoints should be exported");

const legDefinitions = [
  { number: 1, version: 1 },
  { number: 2, version: 1 },
  { number: 1, version: 2 },
  { number: 2, version: 2 },
  { number: 3, version: 2 },
];

const results = [
  { leg_number: 1, leg_version: 1 },
  { leg_number: 2, leg_version: 1 },
  { leg_number: 1, leg_version: 2 },
  { leg_number: 1, leg_version: 2 },
  { leg_number: 2, leg_version: 2 },
  { leg_number: 99, leg_version: 2 },
  { leg_number: null, leg_version: 2 },
  { leg_number: 3, leg_version: null },
];

const normalize = (value) => JSON.parse(JSON.stringify(value));

assert.deepEqual(normalize(buildLatestLegRadarData(results, legDefinitions)), {
  version: 2,
  maxCount: 2,
  data: [
    { leg: "Leg 1", legNumber: 1, count: 2 },
    { leg: "Leg 2", legNumber: 2, count: 1 },
    { leg: "Leg 3", legNumber: 3, count: 0 },
  ],
});

assert.deepEqual(normalize(buildLegRadarVersionOptions(results, legDefinitions)), [
  { label: "All versions", value: "all" },
  { label: "v2", value: 2 },
  { label: "v1", value: 1 },
]);

assert.deepEqual(normalize(buildLegRadarData(results, legDefinitions, 1)), {
  version: 1,
  maxCount: 1,
  data: [
    { leg: "Leg 1", legNumber: 1, count: 1 },
    { leg: "Leg 2", legNumber: 2, count: 1 },
  ],
});

assert.deepEqual(normalize(buildLegRadarData(results, legDefinitions, "all")), {
  version: "all",
  maxCount: 3,
  data: [
    { leg: "Leg 1", legNumber: 1, count: 3 },
    { leg: "Leg 2", legNumber: 2, count: 2 },
    { leg: "Leg 3", legNumber: 3, count: 0 },
  ],
});

assert.deepEqual(
  normalize(
    buildLatestLegRadarData(
      [
        { leg_number: 4, leg_version: 3 },
        { leg_number: 4, leg_version: 3 },
        { leg_number: 2, leg_version: 3 },
      ],
      []
    )
  ),
  {
    version: 3,
    maxCount: 2,
    data: [
      { leg: "Leg 2", legNumber: 2, count: 1 },
      { leg: "Leg 4", legNumber: 4, count: 2 },
    ],
  },
  "falls back to latest version present in runner results when leg definitions are unavailable"
);

assert.deepEqual(normalize(radarPointForIndex(0, 4, 1, 100, 100, 80)), {
  x: 100,
  y: 20,
});
assert.equal(
  formatRadarPoints([
    { x: 1 / 3, y: 2 / 3 },
    { x: 10, y: 20 },
  ]),
  "0.33,0.67 10.00,20.00"
);

console.log("runner leg radar tests passed");

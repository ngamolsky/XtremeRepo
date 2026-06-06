import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/worker/index.ts", import.meta.url), "utf8");

const distanceSchema = /distance:\s*\{[\s\S]*?type:\s*\["number",\s*"null"\][\s\S]*?description:\s*"Observed distance in miles\. Omit when unknown; null is treated as omitted, not as a value to save\."[\s\S]*?\}/.test(source);
const elevationSchema = /elevationGain:\s*\{[\s\S]*?type:\s*\["number",\s*"null"\][\s\S]*?description:\s*"Observed elevation gain in feet\. Omit when unknown; null is treated as omitted, not as a value to save\."[\s\S]*?\}/.test(source);

assert.ok(distanceSchema, "saveLegObservation schema must allow distance:null and tell the model to omit unknown distance");
assert.ok(elevationSchema, "saveLegObservation schema must allow elevationGain:null and tell the model to omit unknown elevation");

assert.match(
  source,
  /type SaveLegObservationInput = \{[\s\S]*?distance\?: number \| null;[\s\S]*?elevationGain\?: number \| null;[\s\S]*?\};/,
  "SaveLegObservationInput should accept explicit nulls from tool calls"
);

assert.match(
  source,
  /function normalizeOptionalPositiveNumber\(value: number \| null \| undefined\): number \| null \| undefined \{[\s\S]*?if \(value === undefined \|\| value === null\) \{[\s\S]*?return undefined;[\s\S]*?\}/,
  "distance:null should normalize to undefined so updates do not write/clear distance"
);

assert.match(
  source,
  /function normalizeOptionalElevationGain\(value: number \| null \| undefined\): number \| null \| undefined \{[\s\S]*?if \(value === undefined \|\| value === null\) \{[\s\S]*?return undefined;[\s\S]*?\}/,
  "elevationGain:null should normalize to undefined so updates do not write/clear elevation_gain"
);

assert.match(
  source,
  /Do not pass null for unknown distance or elevation gain; omit those fields unless the user or source provides a numeric value\./,
  "system prompt should explicitly steer the model to omit unknown distance/elevation instead of sending null"
);

console.log("observation null handling tests passed");

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const iaDoc = read("docs/ui-information-architecture.md");
assert.match(iaDoc, /Races\n2\. Legs\n3\. Runners\n4\. Photos\n5\. Search\n6\. Me/, "IA doc should lock the primary nav order");
assert.match(iaDoc, /Races[\s\S]*Race Detail[\s\S]*Leg Performance[\s\S]*Leg Performance Entry/, "IA doc should define the race-scoped performance hierarchy");
assert.match(iaDoc, /Current\/default version is currently v2/, "IA doc should document current leg-version hiding policy");
assert.match(iaDoc, /agent may read all app data/i, "IA doc should state the agent read boundary");
assert.match(iaDoc, /may only write self-reported\/provisional data or proposed corrections/i, "IA doc should state the agent write boundary");
assert.match(iaDoc, /Correcting official data must be an explicit action/i, "IA doc should make official corrections explicit");

const navigationSource = read("src/components/Navigation.tsx");
const navLabels = Array.from(navigationSource.matchAll(/label: "([^"]+)"/g)).map((match) => match[1]);
assert.deepEqual(
  navLabels.slice(0, 6),
  ["Races", "Legs", "Runners", "Photos", "Search", "Me"],
  "primary/mobile nav labels should use the approved order"
);
assert.doesNotMatch(navigationSource, /label: "Dashboard"|label: "Team"|label: "History"|label: "Upload"/, "demoted pages should not appear in primary nav");
assert.match(navigationSource, /path: "\/runners"/, "Runners nav should point to the canonical runners index");

const indexRoute = read("src/routes/index.tsx");
assert.match(indexRoute, /redirect\(\{ to: "\/races" \}\)/, "home route should land on Races");
assert.ok(existsSync(new URL("../src/routes/runners.tsx", import.meta.url)), "canonical /runners route should exist");

const entityPill = read("src/components/EntityPill.tsx");
for (const category of ["race", "leg", "performance", "performance-entry", "runner"]) {
  assert.match(entityPill, new RegExp(`"?${category}"?:`), `EntityPill should define ${category} category styling`);
}

const sourceBadge = read("src/components/SourceBadge.tsx");
for (const kind of ["official", "accepted-correction", "proposed-correction", "self-reported", "historical-spreadsheet", "historical-pdf", "computed", "inferred", "missing"]) {
  assert.match(sourceBadge, new RegExp(`"?${kind}"?:`), `SourceBadge should define ${kind} source styling/labeling`);
}

const legVersionPath = new URL("../src/lib/legVersion.ts", import.meta.url);
const compiled = ts.transpileModule(readFileSync(legVersionPath, "utf8"), {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    esModuleInterop: true,
  },
}).outputText;
const sandbox = { exports: {}, module: { exports: {} } };
sandbox.exports = sandbox.module.exports;
vm.runInNewContext(compiled, sandbox, { filename: "legVersion.cjs" });
const { CURRENT_LEG_VERSION, formatLegLabel } = sandbox.module.exports;
assert.equal(CURRENT_LEG_VERSION, 2, "current leg version should be v2");
assert.equal(formatLegLabel(3, 2), "Leg 3", "current/default version should be hidden by default");
assert.equal(formatLegLabel(3, 1), "Leg 3 v1", "non-current versions should be shown");
assert.equal(formatLegLabel(3, 2, { alwaysShowVersion: true }), "Leg 3 v2", "callers can force explicit version display");

console.log("UI IA foundation tests passed");

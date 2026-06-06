import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/components/RaceDetailView.tsx", import.meta.url), "utf8");

assert.match(
  source,
  /const RaceLegGroupRow[\s\S]*<Link[\s\S]*to="\/legs\/\$legNumber\/\$version"/,
  "race detail leg group headers should link to the leg detail route"
);

assert.match(
  source,
  /params=\{\{[\s\S]*legNumber: String\(group\.legNumber\)[\s\S]*version: String\(group\.legVersion\)[\s\S]*\}\}/,
  "race detail leg links should pass the displayed leg number and version as route params"
);

assert.match(
  source,
  /aria-label=\{`View Leg \$\{group\.legNumber\} v\$\{group\.legVersion\} details`\}/,
  "race detail leg links should have a clear accessible label"
);

console.log("race detail leg link tests passed");

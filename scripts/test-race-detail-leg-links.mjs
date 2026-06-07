import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/components/RaceDetailView.tsx", import.meta.url), "utf8");

assert.match(
  source,
  /import \{ LegPill \} from "\.\/LegPill";/,
  "race detail should import the shared leg pill link component"
);

assert.match(
  source,
  /const RaceLegGroupRow[\s\S]*<LegPill[\s\S]*leg=\{group\.legNumber\}[\s\S]*version=\{group\.legVersion\}/,
  "race detail leg group headers should render as linked leg pills"
);

assert.match(
  source,
  /liveProjection\.legs\.map[\s\S]*<LegPill[\s\S]*leg=\{leg\.legNumber\}[\s\S]*version=\{leg\.legVersion\}/,
  "race detail live projection leg labels should render as linked leg pills"
);

assert.match(
  source,
  /Leg \{group\.legNumber\} v\{group\.legVersion\}/,
  "race detail leg group pills should show the displayed leg number and version"
);

console.log("race detail leg link tests passed");

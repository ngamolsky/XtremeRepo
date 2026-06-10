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

assert.doesNotMatch(
  source,
  /<h2[^>]*>Live Projection<\/h2>/,
  "race detail should keep projection summary in the hero instead of rendering a separate leg projection table"
);

assert.doesNotMatch(
  source,
  /Leg \{group\.legNumber\} v\{group\.legVersion\}/,
  "race detail leg group pills should defer display text to LegPill so current/default versions can be hidden"
);

assert.doesNotMatch(
  source,
  /Leg \{leg\.legNumber\} v\{leg\.legVersion\}/,
  "race detail live projection pills should defer display text to LegPill so current/default versions can be hidden"
);

console.log("race detail leg link tests passed");

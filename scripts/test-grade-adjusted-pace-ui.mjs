import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const raceDetailSource = readFileSync(new URL("../src/components/RaceDetailView.tsx", import.meta.url), "utf8");
const runInstanceSource = readFileSync(new URL("../src/components/RunInstanceDetail.tsx", import.meta.url), "utf8");
const raceDisplaySource = readFileSync(new URL("../src/lib/raceDisplay.ts", import.meta.url), "utf8");

assert.match(
  raceDisplaySource,
  /gradeAdjustedPace:\s*number \| null/,
  "display leg results should carry grade adjusted pace for both official and self recorded entries"
);
assert.match(
  raceDisplaySource,
  /getGradeAdjustedPace\(/,
  "race display data shaping should compute grade adjusted pace from pace, distance, and elevation"
);

assert.match(
  raceDetailSource,
  /gradeAdjustedPace:\s*number \| null/,
  "race detail leg entries should include grade adjusted pace"
);
assert.match(
  raceDetailSource,
  /label="GAP"/,
  "race detail leg cards should render a GAP metric for official and self recorded entries"
);
assert.match(
  raceDetailSource,
  /value=\{formatGradeAdjustedPace\(entry\.gradeAdjustedPace\)\}/,
  "race detail GAP metric should use the shared grade adjusted pace formatter"
);

assert.match(
  runInstanceSource,
  /Grade Adjusted Pace/,
  "run instance official result should display grade adjusted pace"
);
assert.match(
  runInstanceSource,
  /EvidenceHeader label="GAP"/,
  "run instance self recorded evidence table should include GAP"
);
assert.match(
  runInstanceSource,
  /formatGradeAdjustedPace\(getObservationGradeAdjustedPace\(observation\)\)/,
  "run instance self recorded evidence should compute GAP for each provisional observation"
);

console.log("grade adjusted pace UI contract tests passed");

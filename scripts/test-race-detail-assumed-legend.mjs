import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const raceDetailSource = readFileSync(new URL("../src/components/RaceDetailView.tsx", import.meta.url), "utf8");
const runInstanceSource = readFileSync(new URL("../src/components/RunInstanceDetail.tsx", import.meta.url), "utf8");
const expectedLegend = "* means a self recorded value was missing and inherited from the leg default.";

assert.match(raceDetailSource, /assumedMetrics/, "race detail entries should carry assumed metric flags");
assert.match(raceDetailSource, /EntryMetric[\s\S]*assumed/, "race detail entry metrics should render an assumed marker");
assert.ok(
  raceDetailSource.includes(expectedLegend),
  "race detail should explain that asterisks mean missing self recorded values inherited from the leg default"
);

assert.match(
  runInstanceSource,
  /hasAssumedObservationMetrics/,
  "run instance detail should detect self recorded observations with inherited leg default metrics"
);
assert.match(
  runInstanceSource,
  /AssumedObservationValue[\s\S]*assumed/,
  "run instance self recorded table values should render assumed markers"
);
assert.ok(
  runInstanceSource.includes(expectedLegend),
  "run instance self recorded section should explain that asterisks mean missing self recorded values inherited from the leg default"
);

console.log("race detail assumed legend tests passed");

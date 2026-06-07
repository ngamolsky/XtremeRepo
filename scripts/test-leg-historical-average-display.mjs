import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const legDetailSource = readFileSync(new URL("../src/components/LegDetail.tsx", import.meta.url), "utf8");
const runDetailSource = readFileSync(new URL("../src/components/RunInstanceDetail.tsx", import.meta.url), "utf8");

assert.match(
  legDetailSource,
  /label="Historical Average"/,
  "leg detail page should show a historical average time stat"
);
assert.match(
  legDetailSource,
  /getLegHistoricalAverageMinutes\(legStat\)/,
  "leg detail historical average should be derived from leg version stats"
);
assert.match(
  legDetailSource,
  /formatDurationFromMinutes/,
  "leg detail should format the historical average as a duration"
);

assert.match(
  runDetailSource,
  /const legHistoricalAverageMinutes = getRunHistoricalAverageMinutes\(/,
  "run detail should compute the selected leg/version historical average"
);
assert.match(
  runDetailSource,
  /label="Vs Historical Avg"/,
  "run detail official result should show plus or minus versus historical average"
);
assert.match(
  runDetailSource,
  /formatAverageDelta\(officialResult\.time_in_minutes, legHistoricalAverageMinutes\)/,
  "run detail delta should compare the actual run time to the historical average"
);

console.log("leg historical average display tests passed");

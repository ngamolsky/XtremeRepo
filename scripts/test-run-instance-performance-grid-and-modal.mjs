import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/components/RunInstanceDetail.tsx", import.meta.url), "utf8");
const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

assert.match(
  source,
  /type PrimaryPerformanceSource = "official" \| "self-reported" \| "projected"/,
  "run performance page should model best-effort primary data as official, self-reported, or projected"
);

assert.match(
  source,
  /const primaryPerformance[\s\S]*officialResult[\s\S]*observations\[0\][\s\S]*legHistoricalAverageMinutes/,
  "primary performance data should prefer official, then self-reported, then projected historical-average data"
);

assert.match(
  source,
  /<EntityPill[\s\S]*category="runner"[\s\S]*to="\/runners\/\$runnerName"[\s\S]*params=\{\{ runnerName \}\}[\s\S]*\{runnerName\}[\s\S]*<\/EntityPill>[\s\S]*<LegPill[\s\S]*leg=\{selectedLegNumber\}[\s\S]*version=\{selectedVersion\}[\s\S]*Leg \{selectedLegNumber\}[\s\S]*<\/LegPill>/,
  "leg performance page header should put runner pill first, then a simple Leg N pill"
);

assert.doesNotMatch(
  source,
  /<LegPill[\s\S]*View leg page[\s\S]*<\/LegPill>/,
  "leg performance page header should not use action copy inside the leg pill"
);

assert.match(
  source,
  /<SourceBadge[\s\S]*kind=\{primaryPerformanceSourceKind\(primaryPerformance\.source\)\}[\s\S]*label=\{primaryPerformance\.sourceLabel\}/,
  "primary performance source should use the shared SourceBadge precedence colors"
);

assert.match(
  source,
  /<h2[^>]*>[\s\S]*Primary Performance Data[\s\S]*<\/h2>[\s\S]*<dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4"/,
  "main performance section should render with the shared compact performance metric grid"
);

assert.match(
  source,
  /legStartTime: formatLegClockTime\(officialResult\.leg_start_time\)/,
  "official primary performance should carry the official leg start time"
);

assert.match(
  source,
  /legEndTime: formatLegClockTime\(officialResult\.leg_finish_time\)/,
  "official primary performance should carry the official leg end time"
);

assert.match(
  source,
  /<Metric label="Leg Start" value=\{primaryPerformance\.legStartTime\}/,
  "primary performance grid should show leg start time"
);

assert.match(
  source,
  /<Metric label="Leg End" value=\{primaryPerformance\.legEndTime\}/,
  "primary performance grid should show leg end time"
);

assert.match(
  source,
  /paceAssumed: observation\.observed_distance === null && observation\.pace !== null/,
  "self-reported primary pace should track when it was computed from the default distance"
);

assert.match(
  source,
  /gradeAdjustedPaceAssumed: assumedMetrics\.gradeAdjustedPace/,
  "self-reported primary grade adjusted pace should track when distance or elevation came from defaults"
);

assert.match(
  source,
  /gradeAdjustedPace:[\s\S]*observation\.pace !== null[\s\S]*observation\.observed_distance === null[\s\S]*observation\.observed_elevation_gain === null/,
  "assumed grade adjusted pace should only be marked when it can be computed from default distance or elevation"
);

assert.match(
  source,
  /<Metric label="Pace" value=\{formatAssumedMetric\(formatPace\(primaryPerformance\.pace \|\| 0\), primaryPerformance\.paceAssumed\)\}/,
  "primary self-reported pace should show an asterisk when computed from default distance"
);

assert.match(
  source,
  /<Metric label="Grade Adjusted Pace" value=\{formatAssumedMetric\(primaryPerformance\.gradeAdjustedPace, primaryPerformance\.gradeAdjustedPaceAssumed\)\}/,
  "primary self-reported grade adjusted pace should show an asterisk when computed from default distance or elevation"
);

assert.match(
  source,
  /\{primaryPerformance\.hasAssumedMetrics && \([\s\S]*ASSUMED_OBSERVATION_LEGEND/,
  "primary performance grid should show the assumed self-reported metric legend when asterisks are present"
);

assert.match(
  source,
  /<Metric label="Pace" value=\{formatAssumedMetric\(formatPace\(observation\.pace \|\| 0\), assumedMetrics\.pace\)\}/,
  "secondary self-reported pace should also show the assumed metric asterisk"
);

assert.match(
  source,
  /<Metric label="GAP" value=\{formatAssumedMetric\(formatGradeAdjustedPace\(getObservationGradeAdjustedPace\(observation\)\), assumedMetrics\.gradeAdjustedPace\)\}/,
  "secondary self-reported GAP should also show the assumed metric asterisk"
);

assert.match(
  source,
  /<details className="card overflow-hidden"[\s\S]*<summary[\s\S]*Other reports/,
  "non-primary official/self-reported reports should live in a collapsible toggle zone"
);

assert.match(
  source,
  /openObservationModal\(observation\)[\s\S]*Edit self recorded data/,
  "self-reported rows should open an edit modal instead of only linking away"
);

assert.match(
  source,
  /role="dialog"[\s\S]*aria-modal="true"[\s\S]*onSubmit=\{handleSaveObservation\}/,
  "self-reported add/edit form should be presented in a modal dialog"
);

assert.match(
  source,
  /\.from\("leg_result_observations"\)[\s\S]*\.update\(/,
  "modal should update existing self-reported observations"
);

assert.equal(
  packageJson.scripts["test:run-instance-performance-grid"],
  "node scripts/test-run-instance-performance-grid-and-modal.mjs",
  "package.json should expose the run-instance performance grid regression test"
);

console.log("run instance performance grid and modal tests passed");

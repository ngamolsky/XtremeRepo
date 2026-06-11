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
  /<h2[^>]*>[\s\S]*Primary Performance Data[\s\S]*<\/h2>[\s\S]*grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4/,
  "main performance section should render as a responsive metric grid"
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

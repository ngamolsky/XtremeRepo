import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/components/RaceDetailView.tsx", import.meta.url), "utf8");
const heroSection = source.slice(source.indexOf("<section className=\"card overflow-hidden\">"), source.indexOf("<section className=\"card p-6\">"));
const entryRow = source.slice(source.indexOf("const RaceLegEntryRow"), source.indexOf("const EntryMetric"));

assert.match(
  heroSection,
  /FallbackImage[\s\S]*coverUrlCandidates[\s\S]*ImagePlaceholder/,
  "race detail hero should keep the race cover image/thumbnail at the top"
);

assert.match(
  heroSection,
  /RaceSummaryMetric[\s\S]*label="Total time"/,
  "race detail hero should summarize the official, self-recorded, or projected total time"
);

assert.match(
  heroSection,
  /SourceBadge[\s\S]*label=\{heroTotal\.sourceLabel\}/,
  "race detail hero should show a source badge next to the headline total"
);

assert.match(
  heroSection,
  /RaceSummaryMetric[\s\S]*label="Division"[\s\S]*RaceSummaryMetric[\s\S]*label="Overall"/,
  "race detail hero should include placement information in the top summary"
);

assert.doesNotMatch(
  source,
  /<h2[^>]*>Live Projection<\/h2>/,
  "race detail should not render a separate dense live projection section; projection belongs in the hero total"
);

assert.match(entryRow, /EntrySourceBadge/, "race timeline rows should show a source badge");
assert.match(entryRow, /category="runner"/, "race timeline rows should keep runner pills");
assert.match(entryRow, /category="performance"/, "race timeline rows should link out to the leg performance page");
assert.match(entryRow, /label=\{entry\.timeLabel\}/, "race timeline rows should show time");
assert.match(entryRow, /label="Pace"/, "race timeline rows should show pace");
assert.match(entryRow, /label="GAP"/, "race timeline rows should show grade-adjusted pace");
assert.match(entryRow, /label="Distance"/, "race timeline rows should show distance");

assert.doesNotMatch(entryRow, /label="Gain"/, "race timeline rows should delegate elevation gain details to the performance page");
assert.doesNotMatch(entryRow, /category="performance-entry"/, "race timeline rows should delegate result-entry actions to detail pages");
assert.doesNotMatch(entryRow, /entry\.sourceTags\.map/, "race timeline rows should not render detailed source tags");

console.log("race detail overview layout tests passed");

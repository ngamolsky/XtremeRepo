import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/components/RaceDetailView.tsx", import.meta.url), "utf8");
const heroSection = source.slice(source.indexOf("<section className=\"card overflow-hidden\">"), source.indexOf("<section className=\"space-y-4\">"));
const performanceCard = source.slice(source.indexOf("const RaceLegPerformanceCard"), source.indexOf("const EntryMetric"));

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

assert.match(performanceCard, /EntrySourceBadge/, "race timeline rows should show a source badge");
assert.match(performanceCard, /category="runner"/, "race timeline rows should keep runner pills");
assert.match(
  performanceCard,
  /category="runner"[\s\S]*EntrySourceBadge/,
  "race timeline rows should show the runner pill before the source badge"
);
assert.match(performanceCard, /to="\/runs\/\$runnerName\/\$year\/\$legNumber"/, "race timeline cards should link out to the leg performance page");
assert.match(performanceCard, /label=\{entry\.timeLabel\}/, "race timeline rows should show time");
assert.match(performanceCard, /label="Pace"/, "race timeline rows should show pace");
assert.match(performanceCard, /label="GAP"/, "race timeline rows should show grade-adjusted pace");
assert.match(performanceCard, /label="Official distance"/, "race timeline cards should show official leg distance in the leg section");
assert.match(performanceCard, /label="Official elevation"/, "race timeline cards should show official leg elevation in the leg section");
assert.match(performanceCard, /const showReportedDistance = entry\?\.kind !== "official" && !entry\?\.assumedMetrics\.distance;/, "reported distance should only show when distance was actually self-reported");
assert.match(performanceCard, /const showReportedElevation = entry\?\.kind !== "official" && !entry\?\.assumedMetrics\.elevationGain;/, "reported elevation should only show when elevation was actually self-reported");
assert.match(performanceCard, /label="Reported distance"/, "self-reported performance data should show reported distance separately from official leg distance");
assert.match(performanceCard, /label="Reported elevation"/, "self-reported performance data should show reported elevation separately from official leg elevation");

assert.doesNotMatch(performanceCard, /label="Gain"/, "race timeline rows should avoid vague elevation gain labels");
assert.doesNotMatch(performanceCard, /category="performance-entry"/, "race timeline rows should delegate result-entry actions to detail pages");
assert.doesNotMatch(performanceCard, /entry\.sourceTags\.map/, "race timeline rows should not render detailed source tags");

console.log("race detail overview layout tests passed");

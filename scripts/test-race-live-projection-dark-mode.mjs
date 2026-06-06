import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/components/RaceDetailView.tsx", import.meta.url), "utf8");
const liveProjectionStart = source.indexOf("{showLiveProjection && liveProjection && (");
const liveProjectionEnd = source.indexOf("{legSectionTitle}", liveProjectionStart);
const liveProjectionBlock = source.slice(liveProjectionStart, liveProjectionEnd);
const projectionMetricBlock = source.slice(
  source.indexOf("const ProjectionMetric"),
  source.indexOf("const ProjectionHeader")
);

assert.ok(liveProjectionBlock.includes("text-primary-600"), "Live Projection should use the same primary icon color as the sections below");
assert.ok(liveProjectionBlock.includes("dark:divide-slate-800"), "Live Projection table should use the same dark separators as lower sections");
assert.ok(liveProjectionBlock.includes("dark:bg-slate-800"), "Live Projection table header should use neutral slate dark background");
assert.ok(liveProjectionBlock.includes("dark:bg-slate-900"), "Live Projection table body should use neutral card dark background");
assert.ok(liveProjectionBlock.includes("dark:text-slate-100"), "Live Projection important text should be readable in dark mode");
assert.ok(liveProjectionBlock.includes("dark:text-slate-300"), "Live Projection secondary text should be readable in dark mode");
assert.ok(!projectionMetricBlock.includes("bg-amber-50"), "ProjectionMetric cards should not use the amber live-projection-only background");
assert.ok(projectionMetricBlock.includes("bg-gray-50"), "ProjectionMetric cards should match the neutral metric cards used below");
assert.ok(projectionMetricBlock.includes("dark:bg-slate-800"), "ProjectionMetric cards should have neutral dark-mode background");

console.log("race live projection dark mode tests passed");

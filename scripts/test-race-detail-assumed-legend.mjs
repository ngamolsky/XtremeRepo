import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/components/RaceDetailView.tsx", import.meta.url), "utf8");

assert.match(source, /\* means assumed/i, "race detail should explain the assumed metric asterisk");
assert.match(source, /assumedMetrics/, "race detail entries should carry assumed metric flags");
assert.match(source, /EntryMetric[\s\S]*assumed/, "entry metrics should render an assumed marker");

console.log("race detail assumed legend tests passed");

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/components/RunnerDetail.tsx", import.meta.url), "utf8");

assert.match(source, /expandedRaceYears|collapsedRaceYears/, "race results should track expanded/collapsed race sections");
assert.match(source, /aria-expanded=\{[^}]+\}/, "each race header should expose collapsed state with aria-expanded");
assert.match(source, /ChevronDown|ChevronRight|ChevronUp/, "race sections should show a collapse affordance icon");
assert.match(source, /Self Reported/, "provisional race-day data should be labeled Self Reported in the UI");
assert.doesNotMatch(source, />\s*Provisional\s*</, "profile UI should not show a Provisional section/title/badge");
assert.doesNotMatch(source, /No provisional data for this race\./, "empty self reported sections should be hidden, not rendered with an empty state");
assert.match(source, /race\.provisional\.length > 0 &&[\s\S]*title="Self Reported"/, "Self Reported section should only render when there are self reported entries");
assert.doesNotMatch(source, /className="rounded-lg border border-gray-100 bg-gray-50 p-4"/, "race entry groups should not add extra nested card borders");
assert.doesNotMatch(source, /className="rounded-lg border border-gray-200 bg-white p-4"/, "individual race entries should be flattened instead of nested cards");

console.log("runner race profile UI tests passed");

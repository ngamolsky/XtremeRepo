import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const raceDetail = read("src/components/RaceDetailView.tsx");
const history = read("src/components/HistoryView.tsx");
const dashboard = read("src/components/Dashboard.tsx");
const legDetail = read("src/components/LegDetail.tsx");
const runnerDetail = read("src/components/RunnerDetail.tsx");
const runInstanceDetail = read("src/components/RunInstanceDetail.tsx");
const routeExists = existsSync(new URL("../src/routes/leg-results.$resultType.$runnerName.$year.$legNumber.$resultId.tsx", import.meta.url));
const componentExists = existsSync(new URL("../src/components/LegResultDetail.tsx", import.meta.url));

assert.match(
  dashboard,
  /to="\/races\/\$year"[\s\S]*params=\{\{ year: String\(perf\.year\) \}\}/,
  "dashboard year-over-year rows should link race years to race detail pages"
);

assert.match(
  history,
  /to="\/races\/\$year"[\s\S]*params=\{\{ year: String\(race\.year\) \}\}/,
  "history race cards should link directly to race detail pages"
);
assert.doesNotMatch(
  history,
  /<LegPill[\s\S]*leg=\{leg\.leg_number\}[\s\S]*version=\{leg\.leg_version\}/,
  "history should stay a compact race index instead of rendering expanded leg rows"
);
assert.doesNotMatch(
  history,
  /params=\{\{ runnerName: leg\.runner_name \}\}/,
  "history should delegate per-leg runner drilldown to race detail and leg performance pages"
);

assert.match(
  raceDetail,
  /to="\/runners\/\$runnerName"[\s\S]*params=\{\{ runnerName \}\}/,
  "race detail observed runner pills should link to runner detail pages"
);
assert.match(
  raceDetail,
  /<EntityPill[\s\S]*category="runner"[\s\S]*to="\/runners\/\$runnerName"[\s\S]*params=\{\{ runnerName: entry\.runnerName \}\}/,
  "race detail leg entry runner names should be runner entity pills"
);
assert.doesNotMatch(
  raceDetail,
  /category="performance-entry"[\s\S]*to="\/leg-results\/\$resultType\/\$runnerName\/\$year\/\$legNumber\/\$resultId"/,
  "race detail timeline should stay minimal and delegate result-entry actions to the leg performance page"
);
assert.match(
  raceDetail,
  /View performance/,
  "race detail performance links should use the Leg Performance wording instead of vague Open labels"
);
assert.match(
  raceDetail,
  /import EntityPill from "\.\/EntityPill";/,
  "race detail should use shared EntityPill styling for race-centered entity links"
);
assert.match(
  raceDetail,
  /import SourceBadge, \{ type SourceKind \} from "\.\/SourceBadge";/,
  "race detail should use shared SourceBadge styling for official, self-reported, expected, and pending sources"
);
assert.match(
  raceDetail,
  /<EntityPill[\s\S]*category="runner"[\s\S]*to="\/runners\/\$runnerName"[\s\S]*params=\{\{ runnerName \}\}/,
  "race detail observed runner links should be runner entity pills"
);
assert.match(
  raceDetail,
  /<EntityPill[\s\S]*category="performance"[\s\S]*to="\/runs\/\$runnerName\/\$year\/\$legNumber"[\s\S]*View performance/,
  "race detail leg performance action should be a performance entity pill using the simplified public route"
);
assert.match(
  raceDetail,
  /<SourceBadge[\s\S]*kind=\{entry\.kind === "official" \? "official" : "self-reported"\}/,
  "race detail entry source badges should map to the shared source taxonomy"
);
assert.doesNotMatch(
  raceDetail,
  /Leg \{group\.legNumber\} v\{group\.legVersion\}/,
  "race detail leg group pills should let LegPill hide the current/default version when unambiguous"
);
assert.doesNotMatch(
  raceDetail,
  /Leg \{leg\.legNumber\} v\{leg\.legVersion\}/,
  "race detail live projection leg pills should let LegPill hide the current/default version when unambiguous"
);

assert.match(
  legDetail,
  /to="\/races\/\$year"[\s\S]*params=\{\{ year: String\(result\.year\) \}\}/,
  "leg detail result years should link back to race detail pages"
);
assert.match(
  runnerDetail,
  /to="\/races\/\$year"[\s\S]*params=\{\{ year: String\(race\.year\) \}\}/,
  "runner race breakdown headers should expose race detail links"
);
assert.match(
  runnerDetail,
  /to="\/races\/\$year"[\s\S]*params=\{\{ year: String\(year\) \}\}/,
  "runner unknown-leg years should link to race detail pages"
);

assert.match(
  runInstanceDetail,
  /Leg Performance/,
  "run instance detail should use Leg Performance as the user-facing page name"
);
assert.doesNotMatch(
  runInstanceDetail,
  /No official result is recorded for this run instance/,
  "run instance user-facing copy should not call the page a run instance"
);

assert.ok(routeExists, "leg result detail route should exist");
assert.ok(componentExists, "leg result detail component should exist");

const legResultDetail = componentExists ? read("src/components/LegResultDetail.tsx") : "";
assert.match(
  legResultDetail,
  /Leg Result/,
  "leg result detail page should use Leg Result as its title"
);
assert.match(
  legResultDetail,
  /Compare to Official/,
  "self-reported leg result detail should compare data points to official values"
);
assert.match(
  legResultDetail,
  /\.from\("leg_result_observations"\)[\s\S]*\.update\(/,
  "self-reported leg result detail should update leg_result_observations instead of only adding new evidence"
);
assert.match(
  legResultDetail,
  /to="\/runs\/\$runnerName\/\$year\/\$legNumber"/,
  "leg result detail should link back to its parent Leg Performance page using the simplified public route"
);

console.log("information hierarchy links and leg result detail tests passed");

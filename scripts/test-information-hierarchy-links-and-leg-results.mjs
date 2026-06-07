import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const raceDetail = read("src/components/RaceDetailView.tsx");
const history = read("src/components/HistoryView.tsx");
const dashboard = read("src/components/Dashboard.tsx");
const legDetail = read("src/components/LegDetail.tsx");
const runnerDetail = read("src/components/RunnerDetail.tsx");
const runInstanceDetail = read("src/components/RunInstanceDetail.tsx");
const routeExists = existsSync(new URL("../src/routes/leg-results.$resultType.$runnerName.$year.$legNumber.$version.$resultId.tsx", import.meta.url));
const componentExists = existsSync(new URL("../src/components/LegResultDetail.tsx", import.meta.url));

assert.match(
  dashboard,
  /to="\/races\/\$year"[\s\S]*params=\{\{ year: String\(perf\.year\) \}\}/,
  "dashboard year-over-year rows should link race years to race detail pages"
);

assert.match(
  history,
  /<LegPill[\s\S]*leg=\{leg\.leg_number\}[\s\S]*version=\{leg\.leg_version\}/,
  "history expanded leg rows should link versioned legs with LegPill"
);
assert.match(
  history,
  /to="\/runners\/\$runnerName"[\s\S]*params=\{\{ runnerName: leg\.runner_name \}\}/,
  "history expanded leg rows should link runner names to runner detail pages"
);
assert.match(
  history,
  /to="\/runners\/\$runnerName"[\s\S]*params=\{\{ runnerName: participation\.runner_name \}\}/,
  "history unknown-leg roster pills should link to runner detail pages"
);

assert.match(
  raceDetail,
  /to="\/runners\/\$runnerName"[\s\S]*params=\{\{ runnerName \}\}/,
  "race detail observed runner pills should link to runner detail pages"
);
assert.match(
  raceDetail,
  /to="\/runners\/\$runnerName"[\s\S]*params=\{\{ runnerName: entry\.runnerName \}\}/,
  "race detail leg entry runner names should link to runner detail pages"
);
assert.match(
  raceDetail,
  /View performance/,
  "race detail performance links should use the Leg Performance wording instead of vague Open labels"
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
  /to="\/runs\/\$runnerName\/\$year\/\$legNumber\/\$version"/,
  "leg result detail should link back to its parent Leg Performance page"
);

console.log("information hierarchy links and leg result detail tests passed");

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
assert.equal(
  packageJson.scripts["test:historical-results-search-ui"],
  "node scripts/test-historical-results-search-ui.mjs",
  "package.json should expose focused historical results search UI regression test"
);

const routeSource = readFileSync("src/routes/historical-results-search.tsx", "utf8");
assert.match(routeSource, /createFileRoute\("\/historical-results-search"\)/, "route should register /historical-results-search");
assert.match(routeSource, /HistoricalResultsSearchView/, "route should render HistoricalResultsSearchView");

const navSource = readFileSync("src/components/Navigation.tsx", "utf8");
assert.match(navSource, /historical-results-search/, "navigation should link to historical results search");
assert.match(navSource, /Search/, "navigation should label the historical search entry");

const componentSource = readFileSync("src/components/HistoricalResultsSearchView.tsx", "utf8");
assert.match(componentSource, /Historical Results Search/, "search page should have a clear heading");
assert.match(componentSource, /one-off imported Lake Tahoe Relay team-result rows|Search the one-off imported/, "search page should explain the simple imported-row model");
assert.doesNotMatch(componentSource, /semantic search/i, "search UI should not present embeddings as the search mechanism");
assert.doesNotMatch(componentSource, /Embedding query/, "search UI should not embed queries");
assert.match(componentSource, /\/api\/historical-results\/search/, "search page should call the worker search API");
assert.match(componentSource, /useState\(""\)/, "search query input should start blank instead of auto-searching a stale default query");
assert.doesNotMatch(componentSource, /useState\("Xtreme Falcons Vasan leg 4"\)/, "search query input should not preload the old embedding-era default query");
assert.match(componentSource, /No matching historical team results found/, "search UI should explicitly explain true zero-result responses");
assert.match(componentSource, /Team total/, "search results should emphasize underlying team total time");
assert.match(componentSource, /Source row text/, "source row text should be available but de-emphasized");
assert.match(componentSource, /Linked canonical Xtreme record/, "linked canonical race data should be shown when search evidence matches an existing race");
assert.match(componentSource, /canonicalRace/, "search result typing should include joined canonical race payloads");

const workerSource = readFileSync("src/worker/index.ts", "utf8");
assert.match(workerSource, /\/api\/historical-results\/search/, "worker should expose historical search API route");
assert.match(workerSource, /handleHistoricalResultsSearch/, "worker should route search requests to a named handler");
assert.match(workerSource, /v_historical_team_results_search/, "worker should search the structured team result view");
assert.doesNotMatch(workerSource, /match_result_search_chunks/, "worker should not call vector search RPC");
assert.doesNotMatch(workerSource, /text-embedding-3-small/, "worker should not require embeddings for historical result search");
assert.match(workerSource, /searchHistoricalResults: tool/, "agent should expose historical result search as a tool");
assert.match(workerSource, /simplifyHistoricalSearchResults/, "agent tool should return structured performance-oriented search results");
assert.match(workerSource, /enrichCanonicalRaceLinks/, "search API should still join source matches to existing canonical races");
assert.match(workerSource, /matchMethod: "year_bib"/, "canonical race joins should record the year+bib association method");
assert.match(workerSource, /expanded\.add\("extreme"\)/, "historical search should treat Xtreme and Extreme spellings as aliases");

console.log("historical results search UI tests passed");

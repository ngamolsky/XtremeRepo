import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
assert.equal(
  packageJson.scripts["test:result-semantic-search"],
  "node scripts/test-result-semantic-search.mjs",
  "package.json should expose focused semantic search regression test"
);
assert.equal(
  packageJson.scripts["test:historical-results-search-ui"],
  "node scripts/test-historical-results-search-ui.mjs",
  "package.json should expose focused historical results search UI regression test"
);

const routeSource = readFileSync("src/routes/historical-results-search.tsx", "utf8");
assert.match(routeSource, /createFileRoute\("\/historical-results-search"\)/, "route should register /historical-results-search");
assert.match(routeSource, /HistoricalResultsSearchView/, "route should render HistoricalResultsSearchView");

const navSource = readFileSync("src/components/Navigation.tsx", "utf8");
assert.match(navSource, /historical-results-search/, "navigation should link to historical semantic search");
assert.match(navSource, /Search/, "navigation should label the historical search entry");

const componentSource = readFileSync("src/components/HistoricalResultsSearchView.tsx", "utf8");
assert.match(componentSource, /Historical Results Search/, "search page should have a clear heading");
assert.match(componentSource, /semantic search/i, "search page should explain this is semantic search over historical source chunks");
assert.match(componentSource, /team_result/, "search page should expose chunk-type filters including team_result");
assert.match(componentSource, /leg_result/, "search page should expose chunk-type filters including leg_result");
assert.match(componentSource, /\/api\/historical-results\/search/, "search page should call the worker search API");
assert.match(componentSource, /Team total/, "search results should emphasize underlying team total time");
assert.match(componentSource, /Leg performance/, "search results should show structured leg split performance");
assert.match(componentSource, /Raw searchable text/, "raw source chunk text should be available but de-emphasized");
assert.match(componentSource, /Linked canonical Xtreme record/, "linked canonical race data should be shown when search evidence matches an existing race");
assert.match(componentSource, /canonicalRace/, "search result typing should include joined canonical race payloads");

const workerSource = readFileSync("src/worker/index.ts", "utf8");
assert.match(workerSource, /\/api\/historical-results\/search/, "worker should expose historical semantic search API route");
assert.match(workerSource, /handleHistoricalResultsSearch/, "worker should route search requests to a named handler");
assert.match(workerSource, /match_result_search_chunks/, "worker should call the semantic match RPC");
assert.match(workerSource, /text-embedding-3-small/, "worker should embed search queries with the same embedding model");
assert.match(workerSource, /searchHistoricalResults: tool/, "agent should expose historical result semantic search as a tool");
assert.match(workerSource, /simplifyHistoricalSearchResults/, "agent tool should return structured performance-oriented search results");
assert.match(workerSource, /enrichCanonicalRaceLinks/, "search API should join embedded source matches to existing canonical races");
assert.match(workerSource, /matchMethod: "year_bib"/, "canonical race joins should record the year+bib association method");
assert.match(workerSource, /fetchLexicalHistoricalMatches/, "search API should blend lexical exact matches with semantic matches");
assert.match(workerSource, /expanded\.add\("extreme"\)/, "historical search should treat Xtreme and Extreme spellings as aliases");
assert.match(workerSource, /secondTokenIsNumeric/, "whitespace parser should support result rows with bib but no explicit place column");

console.log("historical results search UI tests passed");

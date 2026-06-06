import assert from "node:assert/strict";
import fs from "node:fs";

const hookSource = fs.readFileSync("src/hooks/useRelayData.ts", "utf8");
const agentSource = fs.readFileSync("src/components/FalconAgent.tsx", "utf8");
const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));

assert.match(
  hookSource,
  /RELAY_DATA_INVALIDATED_EVENT/,
  "relay data hook should use a shared invalidation event name"
);
assert.match(
  hookSource,
  /addEventListener\([\s\S]{0,80}RELAY_DATA_INVALIDATED_EVENT/,
  "relay data hook should subscribe to agent data invalidation events"
);
assert.match(
  hookSource,
  /setRefreshNonce\(\(currentNonce\) => currentNonce \+ 1\)/,
  "relay data hook should bump a refresh nonce when agent data changes"
);
assert.match(
  hookSource,
  /}, \[refreshNonce\]\)/,
  "relay data fetch effect should refetch whenever the refresh nonce changes"
);
assert.match(
  hookSource,
  /const fetchSequenceRef = useRef\(0\)/,
  "relay data hook should track overlapping fetches so older responses cannot overwrite newer data"
);
assert.match(
  hookSource,
  /fetchSequenceRef\.current \+= 1/,
  "relay data hook should assign each relay data fetch a sequence number"
);
assert.match(
  hookSource,
  /fetchSequence !== fetchSequenceRef\.current[\s\S]{0,120}return/,
  "relay data hook should ignore stale fetch responses after a newer refresh starts"
);

assert.match(
  agentSource,
  /isRelayDataMutationTool\(event\.toolName\)/,
  "Falco should identify agent tools that mutate relay data"
);
assert.match(
  agentSource,
  /event\.status === "done"[\s\S]{0,160}dispatchRelayDataInvalidated\(\)/,
  "Falco should dispatch a data invalidation after a successful mutating tool result"
);
assert.doesNotMatch(
  agentSource,
  /event\.status === "error"[\s\S]{0,160}dispatchRelayDataInvalidated\(\)/,
  "Falco should not refresh screens after failed mutating tool results"
);

assert.equal(
  packageJson.scripts["test:agent-data-freshness"],
  "node scripts/test-agent-data-freshness.mjs",
  "agent data freshness regression test should be registered in package.json"
);

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const agentSource = readFileSync(new URL("../src/components/FalconAgent.tsx", import.meta.url), "utf8");
const workerSource = readFileSync(new URL("../src/worker/index.ts", import.meta.url), "utf8");

assert.match(agentSource, /Falco/, "agent header should name Falco");
assert.match(agentSource, /Ready to shred race data/i, "welcome message should have Xtreme energy");
assert.match(agentSource, /Ask Falco/i, "input placeholder should use Falco wording");
assert.match(agentSource, /Show Falco/i, "launcher accessibility label should use Falco branding");
assert.match(workerSource, /Falco, the Xtreme Falcons race data crew chief/, "system prompt should define Falco as the Xtreme crew chief");
assert.match(workerSource, /Use Xtreme Falcons flavor/i, "system prompt should explicitly request Xtreme verbiage");
assert.match(workerSource, /Current open race context/i, "system prompt should include an open race context snippet");
assert.match(workerSource, /2026.*exists.*no official/i, "open race context should identify the 2026 shell with no official data yet");
assert.match(workerSource, /default.*leg version.*v2/i, "open race context should remind the agent to default current race entries to v2");

console.log("xtreme agent vibe tests passed");

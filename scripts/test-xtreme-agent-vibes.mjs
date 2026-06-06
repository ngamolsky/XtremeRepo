import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const agentSource = readFileSync(new URL("../src/components/FalconAgent.tsx", import.meta.url), "utf8");
const workerSource = readFileSync(new URL("../src/worker/index.ts", import.meta.url), "utf8");

assert.match(agentSource, /Xtreme Falcons Crew Chief/, "agent header should use Xtreme Falcons branding");
assert.match(agentSource, /Ready to shred race data/i, "welcome message should have Xtreme energy");
assert.match(agentSource, /Ask the Crew Chief/i, "input placeholder should use Xtreme agent wording");
assert.match(agentSource, /Show Xtreme Falcons agent/i, "launcher accessibility label should use Xtreme branding");
assert.match(workerSource, /Xtreme Falcons race data crew chief/, "system prompt should define the agent as the Xtreme crew chief");
assert.match(workerSource, /Use Xtreme Falcons flavor/i, "system prompt should explicitly request Xtreme verbiage");

console.log("xtreme agent vibe tests passed");

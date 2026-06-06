import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const agentSource = readFileSync(new URL("../src/components/FalconAgent.tsx", import.meta.url), "utf8");
const workerSource = readFileSync(new URL("../src/worker/index.ts", import.meta.url), "utf8");
const navigationSource = readFileSync(new URL("../src/components/Navigation.tsx", import.meta.url), "utf8");

assert.match(agentSource, /id="falcon-agent-title"[\s\S]*?>\s*Falco\s*<\/h2>/, "agent header should name the agent Falco");
assert.doesNotMatch(agentSource, /id="falcon-agent-title"[\s\S]*?>\s*Xtreme Falcons Crew Chief\s*<\/h2>/, "agent header should no longer use generic crew chief as the name");
assert.match(workerSource, /Falco/i, "worker system prompt should name the agent Falco");
assert.match(workerSource, /Xtreme Falcons race data crew chief/i, "Falco should still keep the Xtreme Falcons crew chief role");
assert.match(navigationSource, /<Link\s+to="\/"[\s\S]*?<Trophy/, "header logo/title area should be a home link");
assert.match(navigationSource, /aria-label="Go to dashboard"/, "home link should have an accessible dashboard label");
assert.match(navigationSource, /<span className="sm:hidden">Xtreme<\/span>/, "mobile header should still show Xtreme");
assert.match(navigationSource, /<span className="hidden sm:inline">Xtreme Falcons<\/span>/, "desktop header should still show Xtreme Falcons");

console.log("falco branding and home link tests passed");

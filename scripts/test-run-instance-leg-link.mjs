import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/components/RunInstanceDetail.tsx", import.meta.url), "utf8");

assert.match(
  source,
  /View leg page/,
  "run instance detail should include a clear call-to-action link to the leg page"
);

assert.match(
  source,
  /to="\/legs\/\$legNumber"[\s\S]*View leg page|View leg page[\s\S]*to="\/legs\/\$legNumber"/,
  "the clear leg page link should target the simplified public leg detail route"
);

assert.doesNotMatch(
  source,
  /\/legs\/\$legNumber\/\$version/,
  "the clear leg page link should not expose leg version in the public route"
);

console.log("run instance leg link tests passed");

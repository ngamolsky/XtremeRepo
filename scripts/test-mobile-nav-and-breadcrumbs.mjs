import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const navHelperPath = new URL("../src/lib/navigation.ts", import.meta.url);
assert.ok(existsSync(navHelperPath), "src/lib/navigation.ts should provide route-to-nav mapping");

const compiled = ts.transpileModule(readFileSync(navHelperPath, "utf8"), {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    esModuleInterop: true,
  },
}).outputText;
const sandbox = { exports: {}, module: { exports: {} } };
sandbox.exports = sandbox.module.exports;
vm.runInNewContext(compiled, sandbox, { filename: "navigation.cjs" });
const { getActiveNavId } = sandbox.module.exports;

assert.equal(getActiveNavId("/"), "dashboard");
assert.equal(getActiveNavId("/dashboard"), "dashboard");
assert.equal(getActiveNavId("/legs"), "legs");
assert.equal(getActiveNavId("/legs/3/2"), "legs", "nested leg pages should keep Legs selected");
assert.equal(getActiveNavId("/races/2026"), "races", "race detail pages should keep Races selected");
assert.equal(getActiveNavId("/photos/photo-123"), "photos", "photo detail pages should keep Photos selected");
assert.equal(getActiveNavId("/runners/Nikita"), "team", "runner detail pages should keep Team selected");
assert.equal(getActiveNavId("/runs/Nikita/2026/3/2"), "team", "run detail pages should keep Team selected");

const navigationSource = readFileSync(new URL("../src/components/Navigation.tsx", import.meta.url), "utf8");
assert.doesNotMatch(navigationSource, /<select/, "mobile nav should not use the broken dropdown");
assert.match(navigationSource, /aria-current=\{activeTabId === tab\.id \? "page" : undefined\}/, "mobile nav should mark the selected tab with aria-current");
assert.match(navigationSource, /activeTabId === tab\.id[\s\S]*bg-primary-600/, "mobile nav selected tab should have highlighted styling");

const breadcrumbSource = readFileSync(new URL("../src/components/Breadcrumbs.tsx", import.meta.url), "utf8");
assert.match(breadcrumbSource, /aria-label="Breadcrumb"/, "breadcrumbs should expose breadcrumb navigation semantics");

const nestedComponents = [
  ["RunnerDetail", "../src/components/RunnerDetail.tsx", "Team", "to: \"/team\""],
  ["LegDetail", "../src/components/LegDetail.tsx", "Legs", "to: \"/legs\""],
  ["RaceDetailView", "../src/components/RaceDetailView.tsx", "Races", "to: \"/races\""],
  ["PhotoDetailView", "../src/components/PhotoDetailView.tsx", "Photos", "to: \"/photos\""],
  ["RunInstanceDetail", "../src/components/RunInstanceDetail.tsx", "Team", "to: \"/team\""],
];

for (const [name, relativePath, parentLabel, parentRoute] of nestedComponents) {
  const source = readFileSync(new URL(relativePath, import.meta.url), "utf8");
  assert.match(source, /import Breadcrumbs from "\.\/Breadcrumbs";/, `${name} should import breadcrumbs`);
  assert.match(source, new RegExp(`<Breadcrumbs[\\s\\S]*label: "${parentLabel}"[\\s\\S]*${parentRoute}`), `${name} should link breadcrumb back to ${parentLabel}`);
}

console.log("mobile nav and breadcrumb tests passed");

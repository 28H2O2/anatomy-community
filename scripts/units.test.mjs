import assert from "node:assert/strict";
import test from "node:test";
import { analyzeSource, loadParser } from "./analyze.mjs";
import { figuresOf } from "./changed.mjs";
import { fingerprintOf } from "./fingerprint.mjs";
import { checkImports, scanText } from "./safety.mjs";
import { validateFigure } from "./schema.mjs";
import { scopeProblems } from "./scope-pr.mjs";

const good = { id: "token-bucket", title: "Token bucket", author: "octo-cat", prompt: "/anatomy explain a token bucket", kind: "SVG + WebGL", agent: "Codex", skill: { kit: "sha256:" + "a".repeat(64) }, build: [["src/build.mjs", "--light"], ["src/build.mjs"]], pages: { light: "src/a-light.html", dark: "src/a.html" }, license: "MIT", tags: ["networking"], created: "2026-10-12" };

test("the fingerprint is stable, order-free and limited to the kit", () => {
  const a = fingerprintOf([["kit/b.mjs", "2"], ["kit/a.mjs", "1"], ["scripts/inline-kit.mjs", "3"], ["README.md", "x"]]);
  assert.equal(a, fingerprintOf([["scripts/inline-kit.mjs", "3"], ["kit/a.mjs", "1"], ["kit/b.mjs", "2"]]));
  assert.notEqual(a, fingerprintOf([["kit/a.mjs", "1!"], ["kit/b.mjs", "2"], ["scripts/inline-kit.mjs", "3"]]));
  assert.equal(fingerprintOf([["kit/.DS_Store", "junk"], ["kit/a.mjs", "1"]]), fingerprintOf([["kit/a.mjs", "1"]]));
});

test("a complete figure.json passes the schema", () => assert.deepEqual(validateFigure(good, { author: "octo-cat", id: "token-bucket" }), []));
for (const [name, patch, where, pattern] of [
  ["unknown fields", { extra: 1 }, {}, /unknown field "extra"/],
  ["a dark page without a light one", { pages: { dark: "src/a.html" } }, {}, /pages\.light is required/],
  ["paths outside src", { pages: { light: "../x.html" } }, {}, /pages\.light must be an \.html file under src/],
  ["--audit inside build", { build: [["src/build.mjs", "--audit"]] }, {}, /put --audit in the audit field/],
  ["an author that is not the folder", {}, { author: "someone-else" }, /must match the folder figures\/someone-else/],
  ["an id that is not the folder", {}, { id: "other" }, /must match the folder name "other"/],
  ["a bad kind", { kind: "Canvas" }, {}, /kind must be one of/],
  ["a bad date", { created: "2026-13-45" }, {}, /created must be a date/],
]) test(`the schema rejects ${name}`, () => assert.ok(validateFigure({ ...good, ...patch }, where).some((e) => pattern.test(e))));

test("figure folders are figures/<author>/<id>/", () => {
  assert.deepEqual(figuresOf(["figures/octo-cat/a-b/figure.json", "figures/octo-cat/a-b/src/x.mjs", "README.md"]), { ids: ["octo-cat/a-b"], bad: [] });
  assert.deepEqual(figuresOf(["figures/a-b/figure.json"]).bad, ["figures/a-b/figure.json"]);
  assert.deepEqual(figuresOf(["figures/Octo/Bad_Name/x"]).bad, ["Octo/Bad_Name"]);
});

test("contributors stay in their own folder", () => {
  const files = (...paths) => paths.map((filename) => ({ filename, status: "added" }));
  assert.deepEqual(scopeProblems({ files: files("figures/octo-cat/a/figure.json"), login: "Octo-Cat", association: "NONE" }), []);
  assert.equal(scopeProblems({ files: files("figures/someone/a/figure.json"), login: "octo-cat", association: "NONE" }).length, 1);
  assert.equal(scopeProblems({ files: files(".github/workflows/check.yml", "scripts/validate.mjs"), login: "octo-cat", association: "FIRST_TIME_CONTRIBUTOR" }).length, 2);
  assert.equal(scopeProblems({ files: [{ filename: "figures/octo-cat/a/figure.json", status: "removed" }], login: "octo-cat", association: "NONE" }).length, 1);
  assert.equal(scopeProblems({ files: [{ filename: "figures/octo-cat/b/figure.json", status: "renamed", previous_filename: "figures/someone/b/figure.json" }], login: "octo-cat", association: "NONE" }).length, 1);
  assert.deepEqual(scopeProblems({ files: files(".github/workflows/check.yml"), login: "wheresryan22", association: "OWNER" }), []);
});

test("the text scan accepts SVG namespaces and the kit's own code", () => {
  assert.deepEqual(scanText("src/a.js", 'document.createElementNS("http://www.w3.org/2000/svg", "path"); if (a < BASE.y) b();'), []);
});
test("imports: relative, the skill and listed Node modules only", () => {
  const ctx = { folder: "/r/figures/a/x", skill: "/r/.skill" };
  assert.deepEqual(checkImports("src/build.mjs", 'import a from "node:fs";\nimport b from "../../../../.skill/kit/iso-kit.mjs";\nimport c from "./live.mjs";', ctx), []);
  for (const bad of ['import x from "lodash";', 'import x from "node:net";', 'import x from "node:module";', 'import x from "node:child_process";', 'import x from "../../../other/x.mjs";']) assert.equal(checkImports("src/build.mjs", bad, ctx).length, 1, bad);
});

const acorn = loadParser();
const backdoors = {
  "a disguised fetch": 'const k = "fe" + "tch"; globalThis[k]("x");',
  "the constructor route to Function": '(() => {}).constructor("return 1")();',
  "process.env": "const t = process.env.TOKEN;",
  "process[\"env\"]": 'const t = process["env"];',
  "a computed import": 'const m = "node:" + "net"; await import(m);',
  "a timer with code in a string": 'setTimeout("alert(1)", 1);',
  "window.parent": 'window.parent.postMessage(1, "*");',
  "document.cookie": "const c = document.cookie;",
  "navigation": 'location.href = "https://evil";',
  "Reflect": 'Reflect.get(globalThis, "fetch");',
  "getBuiltinModule": 'process.getBuiltinModule("child_process");',
  "new Function": 'new Function("a", "return a");',
  "__proto__": "({}).__proto__.x = 1;",
  "WebAssembly": "WebAssembly.instantiate(b);",
  "eval through a global": 'globalThis.eval("1");',
  "Function through window": 'window.Function("1")();',
};
for (const [name, code] of Object.entries(backdoors)) test(`the code analysis catches ${name}`, { skip: !acorn && "acorn not installed" }, () => assert.ok(analyzeSource("t.mjs", code, acorn).length > 0));
for (const [name, code] of Object.entries({ "a local named fetch": "const fetch = (x) => x; fetch(1);", "process.argv": 'const light = process.argv.includes("--light");', "toString": "const s = f.toString();", "reading location.hash": "const h = location.hash;" })) test(`the code analysis allows ${name}`, { skip: !acorn && "acorn not installed" }, () => assert.deepEqual(analyzeSource("t.mjs", code, acorn), []));

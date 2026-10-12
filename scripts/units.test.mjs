import assert from "node:assert/strict";
import test from "node:test";
import { fingerprintOf } from "./fingerprint.mjs";
import { validateFigure } from "./schema.mjs";
import { scanText, checkImports } from "./safety.mjs";
import { figuresOf } from "./changed.mjs";
import { outOfScope, deletedFigures } from "./scope.mjs";

const good = { id: "token-bucket", title: "Token bucket", author: "octo-cat", prompt: "/anatomy explain a token bucket", kind: "SVG + WebGL", agent: "Codex", skill: { kit: "sha256:" + "a".repeat(64) }, build: [["src/build.mjs"], ["src/build.mjs", "--light"]], pages: { dark: "src/a.html", light: "src/a-light.html" }, license: "MIT", tags: ["networking"], created: "2026-10-12" };

test("the fingerprint is stable, order-free and limited to the kit", () => {
  const a = fingerprintOf([["kit/b.mjs", "2"], ["kit/a.mjs", "1"], ["scripts/inline-kit.mjs", "3"], ["README.md", "x"]]);
  const b = fingerprintOf([["scripts/inline-kit.mjs", "3"], ["kit/a.mjs", "1"], ["kit/b.mjs", "2"]]);
  assert.equal(a, b);
  assert.equal(a, "sha256:a249319b0f2a8db4899fbb430c782c55b7699df73809c5c0e4c07495c72eae8c");
  assert.notEqual(a, fingerprintOf([["kit/a.mjs", "1!"], ["kit/b.mjs", "2"], ["scripts/inline-kit.mjs", "3"]]));
  assert.equal(fingerprintOf([["kit/.DS_Store", "junk"], ["kit/a.mjs", "1"]]), fingerprintOf([["kit/a.mjs", "1"]]));
});

test("a complete figure.json passes the schema", () => assert.deepEqual(validateFigure(good, "token-bucket"), []));
for (const [name, patch, pattern] of [
  ["unknown fields", { extra: 1 }, /unknown field "extra"/],
  ["paths outside src", { pages: { dark: "../x.html" } }, /pages\.dark must be an \.html file under src/],
  ["--audit inside build", { build: [["src/build.mjs", "--audit"]] }, /put --audit in the audit field/],
  ["a bad author", { author: "-bad-" }, /author must be a GitHub username/],
  ["a bad kind", { kind: "Canvas" }, /kind must be one of/],
  ["a bad date", { created: "2026-13-45" }, /created must be a date/],
  ["duplicate tags", { tags: ["a", "a"] }, /tags must be up to 8 unique/],
  ["a dark page without a light one", { pages: { dark: "src/a.html" } }, /pages\.light is required/],
]) test(`the schema rejects ${name}`, () => assert.ok(validateFigure({ ...good, ...patch }, "token-bucket").some((e) => pattern.test(e))));

test("the scan accepts SVG namespaces and the kit's own code", () => {
  assert.deepEqual(scanText("src/a.js", 'document.createElementNS("http://www.w3.org/2000/svg", "path"); if (a < BASE.y) b();'), []);
});
test("the scan allows relative, skill and listed Node imports only", () => {
  const ctx = { folder: "/r/figures/x", skill: "/r/.skill" };
  assert.deepEqual(checkImports("src/build.mjs", 'import a from "node:fs";\nimport b from "../../../.skill/kit/iso-kit.mjs";\nimport c from "./live.mjs";', ctx), []);
  assert.equal(checkImports("src/build.mjs", 'import x from "lodash";', ctx).length, 1);
  assert.equal(checkImports("src/build.mjs", 'import x from "node:net";', ctx).length, 1);
});

test("changed figure folders are found and bad names reported", () => {
  assert.deepEqual(figuresOf(["figures/a-b/figure.json", "figures/a-b/src/x.mjs", "README.md", "figures/Bad_Name/x"]), { ids: ["a-b"], bad: ["Bad_Name"] });
});
test("contributors stay inside figures/ and cannot delete figures", () => {
  assert.deepEqual(outOfScope(["figures/a/figure.json", ".github/workflows/check.yml", "scripts/validate.mjs"]), [".github/workflows/check.yml", "scripts/validate.mjs"]);
  assert.deepEqual(deletedFigures(["A\tfigures/a/figure.json", "D\tfigures/b/figure.json"]), ["figures/b/figure.json"]);
});

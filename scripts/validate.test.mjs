import assert from "node:assert/strict";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { validateFolder } from "./validate.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const SEED = join(ROOT, "figures", "dial-indicator");
const SKILL = join(ROOT, ".skill");
const ready = existsSync(SEED) && existsSync(SKILL);

function copy(mutate) {
  const repo = mkdtempSync(join(tmpdir(), "anatomy-figures-"));
  cpSync(SEED, join(repo, "figures", "dial-indicator"), { recursive: true });
  symlinkSync(realpathSync(SKILL), join(repo, ".skill"), "dir");
  const folder = join(repo, "figures", "dial-indicator");
  mutate?.(folder, repo);
  return { folder, repo, done: () => rmSync(repo, { recursive: true, force: true }) };
}
const check = (folder, options = {}) => validateFolder(folder, { noBrowser: true, skill: join(folder, "..", "..", ".skill"), ...options });
const edit = (path, fn) => writeFileSync(path, fn(readFileSync(path, "utf8")));

test("the seed figure passes", { skip: !ready }, () => {
  const { folder, done } = copy();
  try { assert.deepEqual(check(folder).errors, []); } finally { done(); }
});

const faults = [
  ["a committed page that is not what the build makes", (f) => edit(join(f, "src", "dial-indicator.html"), (t) => t.replace("</body>", "<!-- x --></body>")), /rebuild: src\/dial-indicator\.html changed/],
  ["a network call hidden in the build", (f) => edit(join(f, "src", "build.mjs"), (t) => t + '\nconst ping = () => fetch("https://example.org/x");\n'), /safety: .*network request \(fetch\)/],
  ["a forbidden Node module", (f) => edit(join(f, "src", "build.mjs"), (t) => 'import { execSync } from "node:child_process";\n' + t), /safety: .*node:child_process is not allowed/],
  ["reading environment variables", (f) => edit(join(f, "src", "build.mjs"), (t) => t + "\nconst token = process.env.GITHUB_TOKEN;\n"), /safety: .*environment variables/],
  ["an import that leaves the folder", (f) => edit(join(f, "src", "build.mjs"), (t) => 'import "../../other/x.mjs";\n' + t), /safety: .*leaves the figure folder/],
  ["an external script in a page", (f) => edit(join(f, "src", "dial-indicator.html"), (t) => t.replace("</head>", '<script src="https://cdn.example.com/a.js"></script></head>')), /safety: .*external address/],
  ["a wrong kit fingerprint", (f) => edit(join(f, "figure.json"), (t) => t.replace(/sha256:[0-9a-f]{64}/, "sha256:" + "0".repeat(64))), /skill: \.skill has kit/],
  ["an id that does not match the folder", (f) => edit(join(f, "figure.json"), (t) => t.replace('"id": "dial-indicator"', '"id": "dial-gauge"')), /schema: id "dial-gauge" must match/],
  ["a binary in src", (f) => writeFileSync(join(f, "src", "tool.wasm"), "x"), /files: src\/tool\.wasm: file type not allowed/],
  ["an unexpected top-level file", (f) => writeFileSync(join(f, "notes.zip"), "x"), /files: unexpected notes\.zip/],
  ["a poster that is not a PNG", (f) => writeFileSync(join(f, "poster.png"), "not a png"), /poster: poster\.png is not a PNG/],
  ["a build that writes an extra file", (f) => edit(join(f, "src", "build.mjs"), (t) => t + '\nwriteFileSync(join(HERE, "extra.txt"), "x");\n'), /rebuild: the build wrote a new file src\/extra\.txt/],
];
for (const [name, mutate, expected] of faults) test(`rejects ${name}`, { skip: !ready }, () => {
  const { folder, done } = copy(mutate);
  try {
    const result = check(folder);
    assert.ok(result.errors.some((e) => expected.test(e)), `expected ${expected}, got:\n${result.errors.join("\n")}`);
  } finally { done(); }
});

test("a contributor cannot mark a figure featured", { skip: !ready }, () => {
  const { folder, done } = copy((f) => edit(join(f, "figure.json"), (t) => t.replace('"license"', '"featured": true,\n  "license"')));
  try {
    assert.ok(check(folder, { contributor: true }).errors.some((e) => /only maintainers set featured/.test(e)));
    assert.ok(!check(folder).errors.some((e) => /featured/.test(e)));
  } finally { done(); }
});

test("a failed check leaves the folder exactly as it was", { skip: !ready }, () => {
  const { folder, done } = copy((f) => edit(join(f, "src", "dial-indicator.html"), (t) => t.replace("</body>", "<!-- x --></body>")));
  try {
    const before = readFileSync(join(folder, "src", "dial-indicator.html"));
    check(folder);
    assert.ok(readFileSync(join(folder, "src", "dial-indicator.html")).equals(before));
    assert.ok(!existsSync(join(folder, "src", "extra.txt")));
  } finally { done(); }
});

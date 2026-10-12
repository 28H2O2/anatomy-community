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
test("any theme works: one page, custom names, or no pages listed at all", () => {
  assert.deepEqual(validateFigure({ ...good, pages: { dark: "src/a.html" } }), []);
  assert.deepEqual(validateFigure({ ...good, pages: { sepia: "src/a-sepia.html", night: "src/a-night.html" }, preview: "sepia" }), []);
  const { pages, ...withoutPages } = good;
  assert.deepEqual(validateFigure(withoutPages), []);
});
for (const [name, patch, where, pattern] of [
  ["unknown fields", { extra: 1 }, {}, /unknown field "extra"/],
  ["paths outside src", { pages: { light: "../x.html" } }, {}, /pages\.light must be an \.html file under src/],
  ["a preview that is not one of the pages", { preview: "sepia" }, {}, /preview must be the name of one of the pages/],
  ["a bad page name", { pages: { "Night Mode": "src/a.html" } }, {}, /must be a short kebab-case word/],
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

import { deflateSync } from "node:zlib";
import { changedFraction } from "./png.mjs";
import { escapeText, indexPages, latestOf, isWebp, checkPoster, PER_PAGE, ON_FRONT } from "./previews.mjs";
import { commentBody, MARKER } from "./pr-preview.mjs";

function png(width, height, pixel) {
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const body = Buffer.concat([Buffer.from(type), data]); const sum = Buffer.alloc(4); sum.writeUInt32BE(crc(body)); return Buffer.concat([len, body, sum]); };
  const head = Buffer.alloc(13); head.writeUInt32BE(width, 0); head.writeUInt32BE(height, 4); head[8] = 8; head[9] = 2;
  const rows = [];
  for (let y = 0; y < height; y++) { rows.push(0); for (let x = 0; x < width; x++) rows.push(...pixel(x, y)); }
  return Buffer.concat([Buffer.from("89504e470d0a1a0a", "hex"), chunk("IHDR", head), chunk("IDAT", deflateSync(Buffer.from(rows))), chunk("IEND", Buffer.alloc(0))]);
}

test("holding still ignores GPU noise but catches motion", () => {
  const base = png(300, 200, () => [200, 200, 200]);
  const noise = png(300, 200, (x, y) => (x === 10 && y === 10 ? [208, 200, 200] : [200, 200, 200]));
  const moved = png(300, 200, (x) => (x < 30 ? [20, 20, 20] : [200, 200, 200]));
  assert.equal(changedFraction(base, noise).changed, 0);
  assert.ok(changedFraction(base, moved).fraction > 0.05);
});

test("posters must be real PNGs of a sane size", () => {
  assert.equal(checkPoster(png(300, 200, () => [1, 2, 3])), null);
  assert.match(checkPoster(Buffer.from("not a png")), /not a PNG/);
  assert.match(checkPoster(png(100, 100, () => [1, 2, 3])), /outside the expected size/);
  assert.ok(isWebp(Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBPVP8 ")])));
  assert.ok(!isWebp(Buffer.from("<svg onload=alert(1)>")));
});

test("titles cannot inject links, images or HTML into the index or comments", () => {
  const evil = '<img src=x onerror=alert(1)> [click](https://evil) ![x](https://t)';
  const md = [...indexPages([{ ...good, title: evil, author: "octo-cat" }], { repo: "o/r" }).values()].join("\n");
  assert.doesNotMatch(md, /<img src=x|\]\(https:\/\/evil|!\[x\]/);
  assert.equal(escapeText("a|b"), "a&#124;b");
  const body = commentBody({ number: 7, found: [{ author: "octo-cat", id: "token-bucket" }], conclusion: "success", runUrl: "https://github.com/o/r/actions/runs/1", repo: "o/r" });
  assert.ok(body.startsWith(MARKER));
  assert.match(body, /raw\/pr-previews\/pr\/7\/octo-cat\/token-bucket\.png/);
});

test("the index pages: newest on the front, 100 per page, by author and by kind", () => {
  const many = Array.from({ length: 250 }, (_, i) => ({ ...good, id: `figure-${i}`, author: i % 2 ? "octo-cat" : "mona", kind: i % 3 ? "SVG" : "SVG + WebGL", created: `2026-${String(1 + (i % 12)).padStart(2, "0")}-${String(1 + (i % 28)).padStart(2, "0")}` }));
  const pages = indexPages(many, { repo: "o/r" });
  assert.deepEqual([...pages.keys()].filter((k) => k.startsWith("all/")), ["all/1.md", "all/2.md", "all/3.md"]);
  assert.equal((pages.get("README.md").match(/<img /g) ?? []).length, ON_FRONT);
  assert.equal((pages.get("all/1.md").match(/<img /g) ?? []).length, PER_PAGE);
  assert.equal((pages.get("all/3.md").match(/<img /g) ?? []).length, 50);
  assert.match(pages.get("all/2.md"), /\[← Page 1\]\(1\.md\) · Page 2 of 3 · \[Page 3 →\]\(3\.md\)/);
  assert.ok(pages.has("by-author/octo-cat.md") && pages.has("by-author/mona.md") && pages.has("by-kind/svg.md") && pages.has("by-kind/webgl.md") && !pages.has("by-kind/3d.md"));
  assert.match(pages.get("all/1.md"), /src="\.\.\/previews\//);
  assert.equal(latestOf(many).length, 6);
  assert.ok(latestOf(many)[0].created >= latestOf(many)[5].created);
});

import { parseIssue, checkRequest, figureFromGist, rewriteKitImports } from "./submit.mjs";

const issueBody = `### Gist link

https://gist.github.com/Octo-Cat/0123456789abcdef0123

### Figure id

token-bucket

### Title

Token bucket

### Prompt

/anatomy explain a token bucket

### Agent

Codex

### Model

_No response_

### License

MIT

### Tags

networking, Rate Limiting

### Your own work

- [X] I made this figure, and I'm fine with it being shared under the license above.`;

test("the submission form is read field by field", () => {
  const f = parseIssue(issueBody);
  assert.equal(f.gist, "https://gist.github.com/Octo-Cat/0123456789abcdef0123");
  assert.equal(f.id, "token-bucket");
  assert.equal(f.model, "");
  const r = checkRequest(f);
  assert.deepEqual(r.problems, []);
  assert.equal(r.gistId, "0123456789abcdef0123");
  assert.ok(checkRequest({ ...f, gist: "https://evil.example/x" }).problems.length);
  assert.ok(checkRequest({ ...f, own: "- [ ] I made this" }).problems.length);
});

test("kit imports from any install path are pointed at .skill", () => {
  const out = rewriteKitImports('import * as k from "/Users/x/.claude/skills/anatomy/kit/iso-kit.mjs";\nimport { kitScript } from "../../scripts/inline-kit.mjs";\nimport "./live.mjs";\nimport * as g from "~/.agents/skills/anatomy/kit/lathe.mjs";');
  assert.match(out, /from "\.\.\/\.\.\/\.\.\/\.\.\/\.skill\/kit\/iso-kit\.mjs"/);
  assert.match(out, /from "\.\.\/\.\.\/\.\.\/\.\.\/\.skill\/scripts\/inline-kit\.mjs"/);
  assert.match(out, /import "\.\/live\.mjs"/);
  assert.match(out, /from "\.\.\/\.\.\/\.\.\/\.\.\/\.skill\/kit\/lathe\.mjs"/);
});

test("a gist becomes a figure, and unsafe gists are refused", () => {
  const gist = { owner: { login: "octo-cat" }, files: { "build.mjs": { content: 'import * as k from "../../kit/iso-kit.mjs"; const light = process.argv.includes("--light");' } } };
  const fields = parseIssue(issueBody);
  const ok = figureFromGist({ fields, gist, author: "Octo-Cat", kit: "sha256:" + "a".repeat(64), commit: "a".repeat(40), date: "2026-10-12" });
  assert.deepEqual(ok.problems, []);
  assert.deepEqual(ok.figure.build, [["src/build.mjs", "--light"], ["src/build.mjs"]]);
  assert.deepEqual(ok.figure.tags, ["networking", "rate-limiting"]);
  assert.equal(ok.figure.pages, undefined);
  const refuse = (patch, pattern) => assert.ok(figureFromGist({ fields, author: "octo-cat", kit: "sha256:" + "a".repeat(64), date: "2026-10-12", gist: { ...gist, ...patch } }).problems.some((p) => pattern.test(p)), String(pattern));
  refuse({ owner: { login: "someone" } }, /must be one of your own gists/);
  refuse({ files: { "build.mjs": { truncated: true } } }, /too large/);
  refuse({ files: { ...gist.files, "page.html": { content: "<html>" } } }, /leave the built pages out/);
  refuse({ files: { "other.mjs": { content: "1" } } }, /needs a build\.mjs/);
  refuse({ files: { ...gist.files, "tool.wasm": { content: "x" } } }, /only \.mjs/);
});

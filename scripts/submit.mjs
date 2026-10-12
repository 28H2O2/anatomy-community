import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { AUTHOR } from "./changed.mjs";
import { isSourceType } from "./safety.mjs";
import { ID, validateFigure } from "./schema.mjs";

const FIELDS = { "Gist link": "gist", "Figure id": "id", Title: "title", Prompt: "prompt", Agent: "agent", Model: "model", License: "license", Tags: "tags", "Your own work": "own" };
export const GIST = /^https:\/\/gist\.github\.com\/([A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38})\/([0-9a-f]{20,40})\/?$/;
const LIMITS = { file: 1 << 20, total: 2 << 20, files: 40 };

export function parseIssue(body) {
  const fields = {};
  const parts = String(body).replace(/\r\n/g, "\n").split(/^### /m).slice(1);
  for (const part of parts) {
    const [heading, ...rest] = part.split("\n");
    const key = FIELDS[heading.trim()];
    if (!key) continue;
    const value = rest.join("\n").trim();
    fields[key] = value === "_No response_" ? "" : value;
  }
  return fields;
}

export function checkRequest(fields) {
  const problems = [];
  const gist = (fields.gist ?? "").match(GIST);
  if (!gist) problems.push("the gist link must look like https://gist.github.com/your-name/0123456789abcdef0123");
  if (!ID.test(fields.id ?? "") || fields.id.length > 64) problems.push("the figure id must be lowercase words joined by dashes, like token-bucket-bench");
  if (!/^- \[[xX]\] /m.test(fields.own ?? "")) problems.push("please tick that the figure is your own work");
  return { problems, gistOwner: gist?.[1], gistId: gist?.[2] };
}

const SKILL_PATH = /(["'])([^"'\n]*?)((?:^|\/)(?:kit\/[A-Za-z0-9_.\/-]+\.(?:mjs|js|css)|scripts\/inline-kit\.mjs))\1/g;
export function rewriteKitImports(text) {
  return text.replace(SKILL_PATH, (literal, quote, before, suffix) => {
    if (before.startsWith("./") && !before.includes("..") && !before.includes(".claude") && !before.includes("skills")) return literal;
    return `${quote}../../../../.skill/${suffix.replace(/^\//, "")}${quote}`;
  });
}

export function detectKind(text) {
  const webgl = /\bglScript\b|\bglLayer\b|\bGLSL_ISO\b|getContext\(\s*["']webgl2?["']/.test(text);
  const turning = /\bturnScript\b|\bTURN\.mount\b|\bturning\(/.test(text);
  return `SVG${webgl ? " + WebGL" : ""}${turning ? " + 3D" : ""}`;
}

export function figureFromGist({ fields, gist, author, kit, commit, date }) {
  const problems = [];
  if (!gist || typeof gist !== "object") return { problems: ["the gist could not be read"] };
  if (String(gist.owner?.login ?? "").toLowerCase() !== author.toLowerCase()) problems.push(`the gist belongs to @${gist.owner?.login ?? "someone else"}; it must be one of your own gists`);
  const entries = Object.entries(gist.files ?? {});
  if (!entries.length) problems.push("the gist has no files");
  if (entries.length > LIMITS.files) problems.push(`the gist has ${entries.length} files; at most ${LIMITS.files}`);
  const files = new Map();
  let total = 0;
  for (const [name, file] of entries) {
    if (!/^[A-Za-z0-9_][A-Za-z0-9_.-]{0,80}$/.test(name)) problems.push(`${name}: file names may use letters, digits, dots, dashes and underscores`);
    else if (!isSourceType(name)) problems.push(`${name}: only .mjs, .js, .css, .json, .md, .txt and .svg files`);
    else if (name.endsWith(".html")) problems.push(`${name}: leave the built pages out; CI builds them`);
    else if (file.truncated || typeof file.content !== "string") problems.push(`${name}: too large to read from the gist (keep each file under 1 MB)`);
    else {
      total += Buffer.byteLength(file.content);
      if (Buffer.byteLength(file.content) > LIMITS.file) problems.push(`${name} is over 1 MB`);
      files.set(name, /\.m?js$/.test(name) ? rewriteKitImports(file.content) : file.content);
    }
  }
  if (total > LIMITS.total) problems.push("the files add up to more than 2 MB");
  if (!files.has("build.mjs")) problems.push("the gist needs a build.mjs");
  const source = [...files.values()].join("\n");
  const tags = (fields.tags ?? "").split(",").map((t) => t.trim().toLowerCase().replace(/\s+/g, "-")).filter(Boolean);
  const figure = {
    id: fields.id,
    title: (fields.title ?? "").trim(),
    author,
    prompt: (fields.prompt ?? "").trim(),
    kind: detectKind(source),
    agent: fields.agent,
    ...(fields.model ? { model: fields.model.trim() } : {}),
    skill: { kit, ...(commit ? { commit } : {}) },
    build: /--light/.test(files.get("build.mjs") ?? "") ? [["src/build.mjs", "--light"], ["src/build.mjs"]] : [["src/build.mjs"]],
    license: fields.license,
    ...(tags.length ? { tags } : {}),
    created: date,
  };
  problems.push(...validateFigure(figure, { author: author.toLowerCase(), id: fields.id }));
  return { problems, figure, files };
}

export function writeFigure(root, { figure, files }) {
  const folder = join(root, "figures", figure.author.toLowerCase(), figure.id);
  mkdirSync(join(folder, "src"), { recursive: true });
  for (const [name, text] of files) writeFileSync(join(folder, "src", name), text);
  writeFileSync(join(folder, "figure.json"), JSON.stringify(figure, null, 2) + "\n");
  return folder;
}

if (process.argv[1]?.endsWith("submit.mjs")) {
  const [command] = process.argv.slice(2);
  const arg = (name) => process.argv[process.argv.indexOf(name) + 1];
  const fail = (problems) => {
    writeFileSync(arg("--problems"), problems.map((p) => `- ${p}`).join("\n") + "\n");
    console.error(problems.join("\n"));
    process.exit(1);
  };
  const author = arg("--author");
  if (!AUTHOR.test(String(author).toLowerCase())) fail(["the issue author is not a valid GitHub name"]);
  const fields = parseIssue(readFileSync(arg("--issue"), "utf8"));
  if (command === "request") {
    const { problems, gistId, gistOwner } = checkRequest(fields);
    if (problems.length) fail(problems);
    if (gistOwner.toLowerCase() !== author.toLowerCase()) fail([`the gist link points to @${gistOwner}'s gist; submit one of your own`]);
    writeFileSync(arg("--out"), JSON.stringify({ gistId, id: fields.id, title: fields.title }));
  } else if (command === "build") {
    const result = figureFromGist({ fields, gist: JSON.parse(readFileSync(arg("--gist"), "utf8")), author, kit: arg("--kit"), commit: arg("--commit"), date: arg("--date") });
    if (result.problems.length) fail(result.problems);
    console.log(writeFigure(arg("--root"), result));
  } else fail(["unknown command"]);
}

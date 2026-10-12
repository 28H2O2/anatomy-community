import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { AUTHOR } from "./changed.mjs";
import { decodePng } from "./png.mjs";
import { ID, validateFigure } from "./schema.mjs";

export const PREVIEW_LIMIT = 400 << 10;
export const POSTER_LIMIT = 1536 << 10;

export const isWebp = (bytes) => bytes.length > 12 && bytes.subarray(0, 4).toString("latin1") === "RIFF" && bytes.subarray(8, 12).toString("latin1") === "WEBP";

export function checkPoster(bytes) {
  if (bytes.length > POSTER_LIMIT) return "over 1.5 MB";
  try {
    const { width, height } = decodePng(bytes);
    if (width < 200 || height < 150 || width > 4000 || height > 4000) return `${width}×${height} is outside the expected size`;
  } catch (error) {
    return error.message;
  }
  return null;
}

export const escapeText = (text) => String(text).replace(/[\\`*_{}\[\]()<>#+!|~&"']/g, (c) => `&#${c.charCodeAt(0)};`).replace(/\r?\n/g, " ");

export function indexMarkdown(figures, { repo }) {
  const rows = figures
    .slice()
    .sort((a, b) => (b.created ?? "").localeCompare(a.created ?? "") || `${a.author}/${a.id}`.localeCompare(`${b.author}/${b.id}`))
    .map((f) => {
      const folder = `${f.author.toLowerCase()}/${f.id}`;
      return `| <a href="https://github.com/${repo}/tree/main/figures/${folder}"><img src="previews/${folder}.webp" width="360" alt="${escapeText(f.title)}"></a> | **${escapeText(f.title)}**<br>by @${escapeText(f.author)}<br>${escapeText(f.kind)} · ${escapeText(f.agent)} · ${escapeText(f.created)} |`;
    });
  return `# Anatomy community: previews\n\nThis branch is written by CI after every merge to \`main\`. Each preview is the light page of the figure, built from its source in the locked sandbox. Do not edit it by hand.\n\n${figures.length} figure${figures.length === 1 ? "" : "s"}.\n\n| Preview | Figure |\n|---|---|\n${rows.join("\n")}\n`;
}

function walk(dir, out = []) {
  for (const name of existsSync(dir) ? readdirSync(dir) : []) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

export function publishPreviews({ artifact, branch, figuresFile, repo }) {
  const figures = JSON.parse(readFileSync(figuresFile, "utf8")).filter((f) => !validateFigure(f).length && AUTHOR.test(f.author.toLowerCase()) && ID.test(f.id));
  const wanted = new Set(figures.map((f) => `${f.author.toLowerCase()}/${f.id}`));
  const problems = [];
  let copied = 0;
  for (const author of existsSync(artifact) ? readdirSync(artifact) : []) {
    if (!statSync(join(artifact, author)).isDirectory()) continue;
    for (const id of readdirSync(join(artifact, author))) {
      const folder = `${author}/${id}`;
      const source = join(artifact, author, id, "preview.webp");
      if (!AUTHOR.test(author) || !ID.test(id) || !wanted.has(folder)) {
        problems.push(`${folder}: not a figure on main, skipped`);
        continue;
      }
      if (!existsSync(source)) continue;
      const bytes = readFileSync(source);
      if (!isWebp(bytes) || bytes.length > PREVIEW_LIMIT) {
        problems.push(`${folder}: preview.webp is not a WebP under 400 KB, skipped`);
        continue;
      }
      mkdirSync(join(branch, "previews", author), { recursive: true });
      cpSync(source, join(branch, "previews", author, `${id}.webp`));
      copied++;
    }
  }
  for (const file of walk(join(branch, "previews"))) {
    const match = file.slice(join(branch, "previews").length + 1).match(/^([^/]+)\/([^/]+)\.webp$/);
    if (!match || !wanted.has(`${match[1]}/${match[2]}`)) rmSync(file);
  }
  const shown = figures.filter((f) => existsSync(join(branch, "previews", f.author.toLowerCase(), `${f.id}.webp`)));
  writeFileSync(join(branch, "README.md"), indexMarkdown(shown, { repo }));
  return { copied, shown: shown.length, problems };
}

if (process.argv[1]?.endsWith("previews.mjs")) {
  const arg = (name) => process.argv[process.argv.indexOf(name) + 1];
  const result = publishPreviews({ artifact: arg("--artifact"), branch: arg("--branch"), figuresFile: arg("--figures"), repo: arg("--repo") });
  for (const problem of result.problems) console.log(`previews: ${problem}`);
  console.log(`previews: ${result.copied} updated, ${result.shown} in the index`);
}

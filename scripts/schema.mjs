export const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const KINDS = ["SVG", "SVG + WebGL", "SVG + 3D", "SVG + WebGL + 3D"];
export const AGENTS = ["Claude Code", "OpenCode", "Codex", "Other"];
export const LICENSES = ["MIT", "CC-BY-4.0"];
const GITHUB = /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/;
const COMMIT = /^[0-9a-f]{40}$/;
const KIT = /^sha256:[0-9a-f]{64}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TAG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const SOURCE_PATH = /^src\/(?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_-][A-Za-z0-9_.-]*$/;

const KEYS = ["id", "title", "author", "prompt", "kind", "agent", "model", "skill", "build", "pages", "audit", "license", "tags", "created", "featured"];

const text = (value, max) => typeof value === "string" && value.trim() === value && value.length > 0 && value.length <= max;
const safePath = (value) => typeof value === "string" && SOURCE_PATH.test(value) && !value.split("/").includes("..");

export function validateFigure(figure, folderName) {
  const errors = [];
  const fail = (message) => errors.push(message);
  if (!figure || typeof figure !== "object" || Array.isArray(figure)) return ["figure.json must be an object"];
  for (const key of Object.keys(figure)) if (!KEYS.includes(key)) fail(`unknown field "${key}"`);

  if (!ID.test(figure.id ?? "") || figure.id.length > 64) fail("id must be kebab-case, at most 64 characters");
  else if (folderName !== undefined && figure.id !== folderName) fail(`id "${figure.id}" must match the folder name "${folderName}"`);
  if (!text(figure.title, 80)) fail("title is required, at most 80 characters, no surrounding spaces");
  if (!GITHUB.test(figure.author ?? "")) fail("author must be a GitHub username");
  if (!text(figure.prompt, 600)) fail("prompt is required, at most 600 characters: the request that made the figure");
  if (!KINDS.includes(figure.kind)) fail(`kind must be one of: ${KINDS.join(", ")}`);
  if (!AGENTS.includes(figure.agent)) fail(`agent must be one of: ${AGENTS.join(", ")}`);
  if (figure.model !== undefined && !text(figure.model, 60)) fail("model, if given, is at most 60 characters");

  const skill = figure.skill;
  if (!skill || typeof skill !== "object" || Array.isArray(skill)) fail("skill must be an object with kit (and optionally commit)");
  else {
    for (const key of Object.keys(skill)) if (!["kit", "commit"].includes(key)) fail(`unknown field "skill.${key}"`);
    if (!KIT.test(skill.kit ?? "")) fail("skill.kit must be the kit fingerprint, sha256:<64 hex>");
    if (skill.commit !== undefined && !COMMIT.test(skill.commit)) fail("skill.commit, if given, is a full 40-character commit hash");
  }

  const build = figure.build;
  if (!Array.isArray(build) || build.length < 1 || build.length > 4) fail("build must list 1 to 4 commands");
  else build.forEach((command, index) => {
    if (!Array.isArray(command) || command.length < 1 || command.length > 4) return fail(`build[${index}] must be [script, ...flags]`);
    if (!safePath(command[0]) || !/\.m?js$/.test(command[0])) fail(`build[${index}][0] must be a .mjs or .js file under src/`);
    command.slice(1).forEach((flag) => {
      if (typeof flag !== "string" || !/^--[a-z][a-z-]*$/.test(flag)) fail(`build[${index}] flags must look like --light`);
      else if (flag === "--audit") fail("put --audit in the audit field, not in build");
    });
  });

  const pages = figure.pages;
  if (!pages || typeof pages !== "object" || Array.isArray(pages)) fail("pages must be an object with dark and/or light");
  else {
    for (const key of Object.keys(pages)) if (!["dark", "light"].includes(key)) fail(`unknown field "pages.${key}"`);
    if (!pages.dark && !pages.light) fail("pages needs at least one of dark or light");
    for (const key of ["dark", "light"]) if (pages[key] !== undefined && (!safePath(pages[key]) || !pages[key].endsWith(".html"))) fail(`pages.${key} must be an .html file under src/`);
  }

  if (figure.audit !== undefined && typeof figure.audit !== "boolean") fail("audit must be true or false");
  if (!LICENSES.includes(figure.license)) fail(`license must be one of: ${LICENSES.join(", ")}`);
  if (figure.tags !== undefined && (!Array.isArray(figure.tags) || figure.tags.length > 8 || !figure.tags.every((tag) => TAG.test(tag) && tag.length <= 32) || new Set(figure.tags).size !== figure.tags.length)) fail("tags must be up to 8 unique kebab-case words");
  if (!DATE.test(figure.created ?? "") || Number.isNaN(Date.parse(figure.created))) fail("created must be a date, YYYY-MM-DD");
  if (figure.featured !== undefined && typeof figure.featured !== "boolean") fail("featured must be true or false");
  return errors;
}

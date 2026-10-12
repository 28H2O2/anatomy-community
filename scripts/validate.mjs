import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { fingerprintOfSkill } from "./fingerprint.mjs";
import { checkImports, isSourceType, relativeTo, scanText } from "./safety.mjs";
import { validateFigure } from "./schema.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const LIMITS = { page: 4 << 20, folder: 12 << 20, poster: 600 << 10, file: 4 << 20 };
const TOP_LEVEL = ["figure.json", "poster.png", "README.md", "src"];

export function pngSize(buffer) {
  const signature = "89504e470d0a1a0a";
  if (buffer.length < 24 || buffer.subarray(0, 8).toString("hex") !== signature || buffer.subarray(12, 16).toString() !== "IHDR") return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function listFiles(dir, root = dir, out = []) {
  for (const name of readdirSync(dir).sort()) {
    const full = join(dir, name);
    const stat = lstatSync(full);
    if (stat.isSymbolicLink()) out.push({ path: relativeTo(root, full), link: true });
    else if (stat.isDirectory()) listFiles(full, root, out);
    else out.push({ path: relativeTo(root, full), size: stat.size });
  }
  return out;
}

const snapshot = (folder) => new Map(listFiles(join(folder, "src")).filter((f) => !f.link).map((f) => [f.path, readFileSync(join(folder, "src", f.path))]));

function restore(folder, before) {
  const after = snapshot(folder);
  for (const path of after.keys()) if (!before.has(path)) rmSync(join(folder, "src", path));
  for (const [path, bytes] of before) if (!after.has(path) || !after.get(path).equals(bytes)) writeFileSync(join(folder, "src", path), bytes);
}

function run(args, { cwd, timeout }) {
  const result = spawnSync(process.execPath, args, { cwd, timeout, encoding: "utf8", maxBuffer: 64 << 20, env: { PATH: process.env.PATH, HOME: process.env.HOME, CHROME_PATH: process.env.CHROME_PATH ?? "" } });
  return { code: result.status ?? (result.signal ? 1 : 0), output: `${result.stdout ?? ""}${result.stderr ?? ""}`, timedOut: result.error?.code === "ETIMEDOUT" };
}

export function validateFolder(folderArg, options = {}) {
  const folder = resolve(folderArg);
  const id = basename(folder);
  const skill = options.skill ?? join(ROOT, ".skill");
  const errors = [];
  const notes = [];
  const step = (name, problems) => {
    if (problems.length) errors.push(...problems.map((p) => `${name}: ${p}`));
    else notes.push(`${name}: ok`);
    return problems.length === 0;
  };

  let figure;
  try {
    figure = JSON.parse(readFileSync(join(folder, "figure.json"), "utf8"));
  } catch (error) {
    return { id, errors: [`figure.json: ${error.message}`], notes };
  }
  const schemaOk = step("schema", [...validateFigure(figure, id), ...(options.contributor && figure.featured ? ["only maintainers set featured"] : [])]);

  const files = [];
  const layout = [];
  for (const name of readdirSync(folder)) if (!TOP_LEVEL.includes(name)) layout.push(`unexpected ${name} (allowed: ${TOP_LEVEL.join(", ")})`);
  if (!existsSync(join(folder, "src"))) layout.push("src/ is missing");
  else for (const file of listFiles(join(folder, "src"))) {
    files.push(file);
    if (file.link) layout.push(`src/${file.path} is a symlink`);
    else if (!isSourceType(file.path)) layout.push(`src/${file.path}: file type not allowed`);
    else if (file.size > LIMITS.file) layout.push(`src/${file.path} is over ${LIMITS.file >> 20} MB`);
  }
  const total = listFiles(folder).reduce((sum, f) => sum + (f.size ?? 0), 0);
  if (total > LIMITS.folder) layout.push(`folder is ${(total / 1048576).toFixed(1)} MB, over ${LIMITS.folder >> 20} MB`);
  if (schemaOk) for (const key of ["dark", "light"]) {
    const page = figure.pages[key];
    if (!page) continue;
    if (!existsSync(join(folder, page))) layout.push(`pages.${key} ${page} does not exist`);
    else if (lstatSync(join(folder, page)).size > LIMITS.page) layout.push(`${page} is over ${LIMITS.page >> 20} MB`);
    else {
      const theme = (readFileSync(join(folder, page), "utf8").match(/<body[^>]*\bdata-theme="(light|dark)"/) ?? [])[1] ?? "dark";
      if (theme !== key) layout.push(`pages.${key} ${page} is a ${theme} page; build it with${key === "light" ? " --light" : "out --light"}`);
    }
  }
  if (schemaOk) for (const [script] of figure.build) if (!existsSync(join(folder, script))) layout.push(`build script ${script} does not exist`);
  step("files", layout);

  const poster = [];
  if (!existsSync(join(folder, "poster.png"))) poster.push("poster.png is missing");
  else {
    const bytes = readFileSync(join(folder, "poster.png"));
    const size = pngSize(bytes);
    if (!size) poster.push("poster.png is not a PNG");
    else if (size.width < 600 || size.height < 400 || size.width > 3200 || size.height > 2400) poster.push(`poster.png is ${size.width}×${size.height}; keep it between 600×400 and 3200×2400`);
    if (bytes.length > LIMITS.poster) poster.push(`poster.png is over ${LIMITS.poster >> 10} KB`);
  }
  step("poster", poster);

  const safety = [];
  for (const file of files) {
    if (file.link || !isSourceType(file.path) || file.size > LIMITS.file) continue;
    const text = readFileSync(join(folder, "src", file.path), "utf8");
    const path = `src/${file.path}`;
    safety.push(...scanText(path, text), ...checkImports(path, text, { folder, skill }));
  }
  const safe = step("safety", safety);

  if (!schemaOk || !safe || errors.some((e) => e.startsWith("files:"))) return { id, errors, notes, stopped: "fix the problems above first; nothing was built" };

  const kit = [];
  if (!existsSync(skill)) kit.push("no .skill folder: run node scripts/skill.mjs first");
  else {
    const found = fingerprintOfSkill(skill);
    if (found !== figure.skill.kit) kit.push(`.skill has kit ${found}, figure needs ${figure.skill.kit}`);
  }
  if (!step("skill", kit)) return { id, errors, notes };

  const before = snapshot(folder);
  const rebuild = [];
  try {
    for (const command of figure.build) {
      const result = run(command, { cwd: folder, timeout: (options.buildTimeout ?? 300) * 1000 });
      if (result.code !== 0) rebuild.push(`${command.join(" ")} failed${result.timedOut ? " (timed out)" : ""}:\n${result.output.trim().split("\n").slice(-12).join("\n")}`);
    }
    if (!rebuild.length) {
      const after = snapshot(folder);
      for (const [path, bytes] of after) {
        if (!before.has(path)) rebuild.push(`the build wrote a new file src/${path}`);
        else if (!before.get(path).equals(bytes)) rebuild.push(`src/${path} changed when rebuilt: the committed file must be exactly what build produces`);
      }
      for (const path of before.keys()) if (!after.has(path)) rebuild.push(`the build deleted src/${path}`);
    }
  } finally {
    restore(folder, before);
  }
  step("rebuild", rebuild);

  if (figure.audit && !options.skipAudit && !rebuild.length) {
    const audit = [];
    try {
      const [script, ...flags] = figure.build[0];
      const result = run([script, ...flags.filter((f) => f !== "--light"), "--audit"], { cwd: folder, timeout: (options.auditTimeout ?? 2700) * 1000 });
      if (result.code !== 0 || !/\baudit passed\b/.test(result.output)) audit.push(`--audit did not end with "audit passed":\n${result.output.trim().split("\n").slice(-15).join("\n")}`);
    } finally {
      restore(folder, before);
    }
    step("audit", audit);
  } else if (figure.audit) notes.push("audit: skipped");

  if (!options.noBrowser && !rebuild.length) {
    const browser = [];
    const shots = options.shots ? resolve(options.shots) : null;
    if (shots) mkdirSync(shots, { recursive: true });
    try {
      for (const key of ["dark", "light"]) {
        const page = figure.pages[key];
        if (!page) continue;
        const lines = run([join(skill, "scripts", "lines.mjs"), join(folder, page), "--reduced"], { cwd: folder, timeout: 180000 });
        if (lines.code !== 0) browser.push(`line check on ${page}:\n${lines.output.trim().split("\n").slice(-10).join("\n")}`);
        if (shots) {
          const shot = run([join(skill, "scripts", "capture.mjs"), join(folder, page), "--reduced", "--out", join(shots, `${id}-${key}.png`)], { cwd: folder, timeout: 180000 });
          if (shot.code !== 0) browser.push(`screenshot of ${page} failed:\n${shot.output.trim().split("\n").slice(-6).join("\n")}`);
        }
      }
    } finally {
      restore(folder, before);
    }
    step("browser", browser);
  } else if (options.noBrowser) notes.push("browser: skipped");

  return { id, errors, notes };
}

const argv = process.argv.slice(2);
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!argv.length || argv[0].startsWith("--")) {
    console.error("usage: node scripts/validate.mjs figures/<id> [--contributor] [--shots dir] [--no-browser] [--skip-audit]");
    process.exit(1);
  }
  const at = argv.indexOf("--shots");
  const result = validateFolder(argv[0], { contributor: argv.includes("--contributor"), noBrowser: argv.includes("--no-browser"), skipAudit: argv.includes("--skip-audit"), shots: at >= 0 ? argv[at + 1] : null });
  console.log(`figure ${result.id}`);
  for (const note of result.notes) console.log(`  ✓ ${note}`);
  for (const error of result.errors) console.log(`  ✗ ${error.replace(/\n/g, "\n      ")}`);
  if (result.stopped) console.log(`  ${result.stopped}`);
  console.log(result.errors.length ? `failed: ${result.errors.length} problem${result.errors.length === 1 ? "" : "s"}` : "passed");
  process.exit(result.errors.length ? 1 : 0);
}

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { ID } from "./schema.mjs";

export function figuresOf(paths) {
  const ids = new Set();
  const bad = [];
  for (const path of paths) {
    const match = path.match(/^figures\/([^/]+)\//);
    if (!match) continue;
    if (ID.test(match[1])) ids.add(match[1]);
    else bad.push(match[1]);
  }
  return { ids: [...ids].sort(), bad: [...new Set(bad)] };
}

const argv = process.argv.slice(2);
if (process.argv[1]?.endsWith("changed.mjs")) {
  const at = argv.indexOf("--base");
  let paths;
  if (argv.includes("--all")) paths = existsSync("figures") ? readdirSync("figures").map((name) => `figures/${name}/`) : [];
  else if (at >= 0) paths = execFileSync("git", ["diff", "--name-only", "--no-renames", `${argv[at + 1]}...HEAD`]).toString().split("\n").filter(Boolean);
  else {
    console.error("usage: node scripts/changed.mjs --base <sha> | --all");
    process.exit(1);
  }
  const { ids, bad } = figuresOf(paths);
  if (bad.length) {
    console.error(`folder names must be kebab-case: ${bad.join(", ")}`);
    process.exit(1);
  }
  for (const id of ids) if (existsSync(`figures/${id}`)) console.log(id);
}

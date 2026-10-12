import { execFileSync } from "node:child_process";

export const MAINTAINERS = ["OWNER", "MEMBER", "COLLABORATOR"];

export function outOfScope(paths) {
  return paths.filter((path) => !/^figures\/[^/]+\//.test(path));
}

export function deletedFigures(statusLines) {
  return statusLines.filter((line) => /^D\tfigures\//.test(line)).map((line) => line.slice(2));
}

const argv = process.argv.slice(2);
if (process.argv[1]?.endsWith("scope.mjs")) {
  const base = argv[argv.indexOf("--base") + 1];
  const association = argv[argv.indexOf("--association") + 1] ?? "";
  if (!base || argv.indexOf("--base") < 0) {
    console.error("usage: node scripts/scope.mjs --base <sha> --association <author_association>");
    process.exit(1);
  }
  if (MAINTAINERS.includes(association)) {
    console.log(`scope: ${association.toLowerCase()}, any file may change`);
    process.exit(0);
  }
  const status = execFileSync("git", ["diff", "--name-status", "--no-renames", `${base}...HEAD`]).toString().split("\n").filter(Boolean);
  const paths = status.map((line) => line.split("\t").pop());
  const outside = outOfScope(paths);
  const deleted = deletedFigures(status);
  const problems = [...outside.map((p) => `${p}: contributors can only change files under figures/<id>/`), ...deleted.map((p) => `${p}: contributors cannot delete figure files; ask a maintainer`)];
  if (problems.length) {
    for (const problem of problems) console.error(`scope: ${problem}`);
    process.exit(1);
  }
  console.log(`scope: ok (${paths.length} file${paths.length === 1 ? "" : "s"} under figures/)`);
}

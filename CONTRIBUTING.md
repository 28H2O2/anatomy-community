# Contributing a figure

Thank you for sharing one. A figure here is a real, working object that explains an idea, made with the [Anatomy](https://github.com/wheresryan22/anatomy) skill in Claude Code, OpenCode or Codex.

## What can be published

- **Framework-free figures:** a build script (usually `build.mjs`) that writes standalone pages next to itself, as the skill's examples do. React and Next.js figures can't be published yet.
- **One figure per pull request,** in one folder, `figures/<id>/`.
- **Your own work,** shared under the license you pick in `figure.json` (MIT or CC-BY-4.0).
- **The skill's quality bar:** a recognisable object built from many small precise parts, not boxes, arrows and labels. Every number the figure shows is true.

## Steps

1. **Fork and clone** this repository.
2. **Build your figure** with the skill, and make sure its pages are up to date.
3. **Publish it into your clone.** Ask your agent ("publish this figure to the Anatomy gallery"), or run:

   ```sh
   node <anatomy skill>/scripts/publish.mjs path/to/figure --into . --id <kebab-id> \
     --title "..." --author <your GitHub name> --prompt "the request that made it"
   ```

   Options: `--agent "Claude Code"|OpenCode|Codex|Other`, `--model "..."`, `--license MIT|CC-BY-4.0`, `--tags a,b`, `--audit` (for figures with pipes, cables or round parts), `--pages dark.html,light.html` (if it can't tell which pages are the figure).

   It copies the source into `figures/<id>/src/`, points its kit imports at `.skill/`, records the skill's kit fingerprint, rebuilds the pages and takes the poster. It also links `.skill` to your installed skill (that link is ignored by git).
4. **Check it:**

   ```sh
   node scripts/validate.mjs figures/<id>
   ```

   It has to end with `passed`. It runs the same checks as CI, except that CI fetches the exact skill version from GitHub.
5. **Open a pull request.** The publish script prints the commands.

## figure.json

| Field | Required | Meaning |
|---|---|---|
| `id` | yes | kebab-case, the same as the folder name |
| `title` | yes | at most 80 characters |
| `author` | yes | your GitHub username |
| `prompt` | yes | the request that made the figure, at most 600 characters |
| `kind` | yes | `SVG`, `SVG + WebGL`, `SVG + 3D` or `SVG + WebGL + 3D` |
| `agent` | yes | `Claude Code`, `OpenCode`, `Codex` or `Other` |
| `model` | no | the model, if you want to say |
| `skill.kit` | yes | the kit fingerprint, written by the publish script |
| `skill.commit` | no | a skill commit with that kit, to skip the search |
| `build` | yes | 1 to 4 commands, each `["src/build.mjs", "--light"]`-style |
| `pages` | yes | `dark` and/or `light`: the built pages under `src/` |
| `audit` | no | `true` runs the skill's `--audit` in CI |
| `license` | yes | `MIT` or `CC-BY-4.0` |
| `tags` | no | up to 8 kebab-case words |
| `created` | yes | `YYYY-MM-DD` |
| `featured` | no | set by maintainers only |

## Rules the checks enforce

- **Files:** `figure.json`, `poster.png`, optional `README.md`, and `src/` with `.mjs`, `.js`, `.css`, `.html`, `.json`, `.md`, `.txt` or `.svg` files. No symlinks. Pages up to 4 MB, the folder up to 12 MB, the poster up to 600 KB.
- **Safety:** nothing may load from or talk to the network, open windows or frames, run code from strings, read cookies, or reach the page around it. Build scripts may import only the skill, files in their own folder and `node:fs`, `node:path`, `node:url`, `node:crypto`, `node:process`, and may not read environment variables.
- **Reproducible:** running the build commands must recreate the committed pages exactly and write nothing else.
- **Scope:** a contributor's pull request may only add or change files under `figures/`; it may not delete figures or touch anything else.

## Running the repository's own tests

```sh
node --test scripts/units.test.mjs
node scripts/skill.mjs figures/dial-indicator && node --test scripts/validate.test.mjs
```

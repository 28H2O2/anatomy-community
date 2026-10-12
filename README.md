<h1 align="center">Anatomy community</h1>

<p align="center"><b>Figures the community made with <a href="https://github.com/wheresryan22/anatomy">Anatomy</a>.</b><br>Each one explains an idea as a real, working object.</p>

<p align="center">
  <a href="https://github.com/wheresryan22/anatomy-community/tree/previews"><img src="https://github.com/wheresryan22/anatomy-community/raw/previews/latest/1.webp" width="32%" alt="Newest figure"></a>
  <a href="https://github.com/wheresryan22/anatomy-community/tree/previews"><img src="https://github.com/wheresryan22/anatomy-community/raw/previews/latest/2.webp" width="32%" alt="Second newest figure"></a>
  <a href="https://github.com/wheresryan22/anatomy-community/tree/previews"><img src="https://github.com/wheresryan22/anatomy-community/raw/previews/latest/3.webp" width="32%" alt="Third newest figure"></a>
  <a href="https://github.com/wheresryan22/anatomy-community/tree/previews"><img src="https://github.com/wheresryan22/anatomy-community/raw/previews/latest/4.webp" width="32%" alt="Fourth newest figure"></a>
  <a href="https://github.com/wheresryan22/anatomy-community/tree/previews"><img src="https://github.com/wheresryan22/anatomy-community/raw/previews/latest/5.webp" width="32%" alt="Fifth newest figure"></a>
  <a href="https://github.com/wheresryan22/anatomy-community/tree/previews"><img src="https://github.com/wheresryan22/anatomy-community/raw/previews/latest/6.webp" width="32%" alt="Sixth newest figure"></a>
</p>

<p align="center"><b><a href="https://github.com/wheresryan22/anatomy-community/tree/previews">Browse every figure →</a></b><br>newest first, all of them page by page, by author and by kind</p>

## What this is

A shared collection of figures made with the Anatomy skill. Each figure is stored as its **source**: the `build.mjs` the skill wrote, plus a `figure.json` that says who made it, with what prompt and with which skill version. There are no built pages or images in `main`.

Because every Anatomy figure rebuilds byte for byte from its source, CI rebuilds each one on every check, in a locked sandbox, and makes the pages and the preview image itself. The previews live on the [`previews`](https://github.com/wheresryan22/anatomy-community/tree/previews) branch, which CI rewrites after every merge.

```
figures/<author>/<id>/
  figure.json      title, author, prompt, kind, agent, skill version, license
  src/build.mjs    the source the skill wrote, plus any helper files it reads
  README.md        optional: the idea, in a few lines
```

## Upload a figure

**You need:**
- the [Anatomy skill](https://github.com/wheresryan22/anatomy), in Claude Code, OpenCode or Codex, in a version that has `scripts/publish.mjs`;
- Node.js 22, git and the [GitHub CLI](https://cli.github.com/) (`gh`), signed in;
- [Docker](https://www.docker.com/), optional but recommended, to run the same locked checks as CI before you send.

**1. Fork and clone this repository**

```sh
gh repo fork wheresryan22/anatomy-community --clone
cd anatomy-community
```

**2. Make your figure with Anatomy**

Ask for it as usual, for example `/anatomy explain how a token bucket rate limiter works, interactive`. The gallery takes **plain HTML** figures (a `build.mjs` that writes standalone pages), and it shows the **light** page. So check the light page looks right; a dark page is optional.

**3. Publish it into your clone**

Ask your agent: *"publish this figure to the Anatomy community gallery"*. It asks you for a title and your GitHub name, then runs the publish script. Or run the script yourself:

```sh
node <anatomy skill folder>/scripts/publish.mjs <your figure folder> --into . \
  --id token-bucket-bench --title "Token bucket air bench" --author <your-github-name> \
  --prompt "/anatomy explain how a token bucket rate limiter works, interactive"
```

It copies **only the source** into `figures/<your-github-name>/token-bucket-bench/`, points its kit imports at `.skill/` (a link to your skill, which git ignores), records which skill version made it, checks that it builds, and saves a quick preview to `shots/<your-github-name>-token-bucket-bench/preview.png` so you can see it straight away.

**4. Check it like CI will** (optional, recommended)

```sh
docker build --platform linux/amd64 -t anatomy-sandbox:local sandbox
node scripts/validate.mjs figures/<your-github-name>/token-bucket-bench
```

The first command is only needed once. The check must end with `passed`. It writes the built pages, the poster and screenshots to `shots/`. Without Docker it still runs every check except the network isolation.

**5. Open a pull request**

```sh
git switch -c figure/token-bucket-bench
git add figures/<your-github-name>/token-bucket-bench
git commit -m "Add Token bucket air bench"
git push -u origin figure/token-bucket-bench
gh pr create --repo wheresryan22/anatomy-community --fill
```

**6. Wait for the checks and the preview**

Two checks run (next section). When they finish, a comment on your pull request shows the preview CI made of your figure. A maintainer reviews it and merges. After the merge, your figure appears on the [`previews`](https://github.com/wheresryan22/anatomy-community/tree/previews) branch and, while it is among the six newest, at the top of this page.

## What happens to your pull request

Your figure's `build.mjs` is code from someone else, so it is checked before it runs, and it runs where it can't reach anything.

| | Check | What it does |
|---|---|---|
| 1 | **Scope** | Runs from `main`, never from your pull request. It reads the list of changed files and fails unless every file is under `figures/<your-github-name>/`: no deletions, no changes to CI, scripts or other people's figures. |
| 2 | **Files** | `figure.json` is complete and matches its folder; only source files (`.mjs`, `.js`, `.css`, `.html`, `.json`, `.md`, `.txt`, `.svg`), at most 1 MB each and 2 MB in all; no built pages, no images, no symlinks. |
| 3 | **Code analysis** | Every source file is parsed and refused if it reaches the network, environment variables, cookies, other windows, `eval` or `Function`, by any route however disguised, or imports anything except the skill, its own files, `node:fs`, `node:path`, `node:url`, `node:crypto` and `node:process`. |
| 4 | **Skill version** | The exact Anatomy version that made the figure is found from its kit fingerprint, and that version is used. |
| 5 | **Locked build** | The build runs **twice** in a pinned container (Node 22.23.3, Chrome for Testing 155) with no network, a read-only system, no privileges, limited memory, processes and time, and write access only to its own `src/`. Both runs must write exactly the pages listed in `figure.json`, byte for byte the same. |
| 6 | **Output** | The built pages get the same safety scan, so a payload the source hides is still caught. Each page is at most 4 MB. |
| 7 | **Browser** | Chrome loads every page in the same locked container. The skill's line check must pass, nothing may try to load from outside, and the figure must hold still with reduced motion on. |
| 8 | **Preview** | The light page becomes the poster and the preview posted on your pull request. |

The checker always comes from `main`, never from the pull request. Figure code only ever runs inside the sandbox, with a read-only token and no secrets, and the jobs that write previews never run figure code. A check takes about 2 minutes for a simple figure and 10–20 for a heavy one with `--audit`.

## Run the tests yourself

The repository tests its own checker, including planted attacks that every check must catch:

```sh
node --test scripts/units.test.mjs
node scripts/skill.mjs figures/wheresryan22/dial-indicator
node --test scripts/validate.test.mjs
```

The second test file uses the Docker sandbox when it's there (build it as in step 4) and runs its sandbox-escape tests only then. The code-analysis tests need `acorn` on `NODE_PATH`:

```sh
npm install --prefix /tmp/anatomy-tools acorn@8.19.0
NODE_PATH=/tmp/anatomy-tools/node_modules node --test scripts/units.test.mjs
```

## Rules in short

Your own work, in your own folder, under MIT or CC-BY-4.0. A real object built from many small precise parts, not boxes and arrows, and every number it shows is true. Plain HTML, light page required. Deterministic, still under reduced motion, and nothing that talks to the outside. [CONTRIBUTING.md](CONTRIBUTING.md) has the full rules and every field of `figure.json`.

## For maintainers

- Protect `main`: require a pull request with a review, and require the **Scope** and **Check figures** checks.
- In Actions settings, require approval before workflows run for outside contributors.
- The **Previews** workflow can be run by hand (Actions → Previews → Run workflow) to rebuild every preview.

## License

MIT, unless a figure's `figure.json` says `CC-BY-4.0`. Every figure credits its author.

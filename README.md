<h1 align="center">Anatomy community</h1>

<p align="center"><b>Figures the community made with <a href="https://github.com/wheresryan22/anatomy">Anatomy</a>.</b><br>Each one explains an idea as a real, working object, and each one is rebuilt from its source on every check.<br>Plain HTML, light theme first.</p>

## What's in here

Only the source of each figure, filed under its author:

```
figures/<author>/<id>/
  figure.json      title, author, prompt, kind, agent, skill version, license
  src/             what the skill wrote: build.mjs and its helper files
  README.md        optional: the idea, in a few lines
```

There are no built pages or posters in the repository. Every figure rebuilds byte for byte from its source with the exact skill version it was made with, so CI builds the pages and the poster itself. That keeps the repository small: a figure is usually 10–100 KB of source.

## Add your figure

Make a figure with the Anatomy skill, then ask your agent to publish it, or run the skill's script yourself:

```sh
node <anatomy skill>/scripts/publish.mjs path/to/your-figure --into path/to/anatomy-community \
  --id token-bucket-bench --title "Token bucket air bench" --author your-github-name \
  --prompt "/anatomy explain how a token bucket rate limiter works, interactive"
```

Then check it and open a pull request. [CONTRIBUTING.md](CONTRIBUTING.md) has every step.

## How a figure is checked

A figure's build script is code from someone else, so it is checked before it runs and run where it can do nothing:

| Check | What it proves |
|---|---|
| Scope | a trusted workflow, run from `main` and never from the pull request, confirms the pull request only touches `figures/<your-github-name>/` |
| Schema and files | `figure.json` is complete and matches its folder; only source files, within the size limits, no symlinks, no built pages |
| Code analysis | the source is parsed and refused if it reaches the network, the environment, other pages, `eval` or `Function` by any route, or imports anything but the skill, its own files and a few file-system modules |
| Skill version | the exact skill version that made the figure is found from its kit fingerprint and used |
| Locked build | the build runs twice in a container with no network, a read-only system, no privileges, limited memory and time, and write access to its own folder only; both runs must produce identical pages and nothing else |
| Output | the built pages are scanned too, so a payload the source hides is still caught |
| Browser | Chrome loads the pages in the same locked container: the line check passes, nothing tries to load from outside, and the figure holds still with reduced motion |

The checker always comes from `main`, never from the pull request. Built pages, the poster and screenshots are attached to each run for the reviewer. A maintainer reviews and merges; nothing merges by itself.

## License

MIT, unless a figure's `figure.json` says `CC-BY-4.0`. Every figure credits its author.

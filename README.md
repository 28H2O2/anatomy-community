<h1 align="center">Anatomy figures</h1>

<p align="center"><b>Figures the community made with <a href="https://github.com/wheresryan22/anatomy">Anatomy</a>.</b><br>Each one explains an idea as a real, working object, and each one rebuilds from its own source.</p>

## What's in here

One folder per figure:

```
figures/<id>/
  figure.json      title, author, prompt, kind, agent, skill version, license
  poster.png       the thumbnail
  src/             the source the skill wrote, plus the built pages
  README.md        optional: the idea, in a few lines
```

`figure.json` is described in [CONTRIBUTING.md](CONTRIBUTING.md#figurejson) and [schema/figure.schema.json](schema/figure.schema.json).

## Add your figure

Make a figure with the Anatomy skill, then ask your agent to publish it, or run the skill's script yourself:

```sh
node <anatomy skill>/scripts/publish.mjs path/to/your-figure \
  --into path/to/anatomy-figures --id token-bucket-bench \
  --title "Token bucket air bench" --author your-github-name \
  --prompt "/anatomy explain how a token bucket rate limiter works, interactive"
```

Then check it and open a pull request. [CONTRIBUTING.md](CONTRIBUTING.md) has every step.

## How a figure is checked

Every pull request runs the same checks, on a fresh machine with no secrets:

| Check | What it proves |
|---|---|
| Schema | `figure.json` is complete and its id matches the folder |
| Files | only source files under `src/`, nothing over the size limits, no symlinks |
| Poster | a real PNG of a sensible size |
| Safety | no network calls, outside addresses, `eval`, frames, cookies or other pages; the build imports only the skill, its own files and `node:fs`, `node:path`, `node:url`, `node:crypto` |
| Skill version | the skill version that made the figure is found from its kit fingerprint, and that exact version is used |
| Rebuild | the build reproduces the committed pages byte for byte and writes nothing else |
| Audit | for figures that ask for it, the skill's `--audit` passes |
| Line ends | the skill's line check passes in Chrome on every page |

Screenshots of every page are attached to the run for the reviewer. A maintainer reviews and merges; nothing is merged automatically.

## License

MIT, unless a figure's `figure.json` says `CC-BY-4.0`. Every figure credits its author.

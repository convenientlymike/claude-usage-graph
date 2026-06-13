# Changelog

All notable changes to claude-usage-graph are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project follows
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] — 2026-06-12

Initial release.

### Added
- **Aggregate** Claude Code session transcripts (`~/.claude/projects/**/*.jsonl`)
  into per-day and per-model token totals — input / output / cache-create / cache-read.
  Reads counts, timestamps, and the model id only; never project names or content.
- **3D isometric calendar SVG** — a GitHub-contribution-style card where each day is a
  cube whose height + color scale with that day's token volume, plus a hero stat
  (total · active days · daily average · peak day) and a per-model split bar. Native SVG
  primitives (no `<foreignObject>`), so it renders identically on GitHub, iOS, and any
  rasterizer.
- **Themes** — `brand` (violet→cyan, default), `github` (greens), `amber`, `mono`.
- **Optional PNG** via the optional `@resvg/resvg-js` dependency (`--png`, `--scale`);
  the SVG path needs nothing.
- **CLI** — `--out`, `--png`, `--scale`, `--theme`, `--title`, `--dir`, `--json`,
  `--emit-json`, `--stats`, `--help`, `--version`.
- **Library API** — `aggregateDir`, `fromJson`, `toJson`, `renderSVG`, `renderPNG`, `THEMES`.
- **Privacy** — `--emit-json` writes exactly what is rendered (a counts-only map) so you
  can inspect what's shared; `--json` renders from such a file without touching transcripts.
- Cross-platform (macOS · Linux · Windows); Node ≥ 22; zero required runtime dependencies.
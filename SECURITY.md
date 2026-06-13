# Security Policy

## Reporting a vulnerability

Report privately via GitHub's **"Report a vulnerability"** (Security → Advisories)
on this repository, or open a minimal issue asking for a private channel (omit
exploit details).

## Scope & threat model

claude-usage-graph is a local CLI with **zero required runtime dependencies**
(PNG output uses the optional `@resvg/resvg-js`). It:

- reads your Claude Code session transcripts under `~/.claude/projects/**/*.jsonl`
  (or a directory / JSON you point it at) and writes an SVG/PNG you ask for;
- makes **no network calls** of its own and collects **no telemetry**.

The important property: it only ever **reads token counts, timestamps, and the
model id**, and only ever **emits aggregate daily counts**. It never reads or
writes project names, file paths, prompts, or message content — so the card it
produces is safe to publish on a public profile.

Notes:

- `--emit-json <file>` writes exactly what would be rendered (a `{ byDay, byModel }`
  count map). Inspect it to confirm precisely what leaves your machine before
  sharing a card.
- `--json <file>` renders from such a JSON instead of touching transcripts at all —
  useful if you want to aggregate on one machine and render on another.
- No transcript content is ever included in the output or logged anywhere.
# Contributing

Thanks for your interest! claude-usage-graph is a small, dependency-light tool;
contributions that keep it that way are very welcome.

## Dev setup

```bash
pnpm install          # or: npm install
pnpm build            # tsc -> dist/
pnpm test             # node --test (fixtures in test/)
pnpm typecheck        # tsc --noEmit
pnpm dev -- --stats   # run the CLI from source (tsx)
```

Requirements: **Node ≥ 22**. Works on **macOS, Linux, and Windows** — CI runs the
full matrix, so keep code portable: use `node:path` / `node:os` (never hardcode
`/tmp`, `~`, or `C:\`) and don't shell out to Unix-only tools.

## Principles

- **Zero *required* runtime dependencies.** The core (aggregate + SVG render) is
  pure TypeScript. PNG output is an *optional* extra (`@resvg/resvg-js`), loaded
  lazily — don't add a hard dependency without a strong reason.
- **Aggregate counts only.** The parser must never surface project names, file
  paths, prompts, or message content — only token counts, timestamps, and the
  model id. Anything that would leak content is a non-starter.
- **Cross-OS + native SVG.** The card is plain SVG primitives (no `<foreignObject>`)
  so it renders identically everywhere.

## Adding a theme

Themes live in `THEMES` in [`src/render.ts`](src/render.ts) — `brand` (default),
`github`, `amber`, `mono`. A theme is a palette: `empty`, a 4-stop `ramp`
(low→high), panel `bg`/`border`, `txt`/`sub`, two `accent`s, four `model` colors,
and two `glow` colors. Add an entry, then regenerate the playground/README sample
to check it.

## Commits & PRs

Conventional-commit style (`feat:`, `fix:`, `docs:`, `chore:`). Keep PRs focused;
run `pnpm typecheck && pnpm test` before opening one, and add a `CHANGELOG.md`
`[Unreleased]` line for user-facing changes.
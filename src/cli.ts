#!/usr/bin/env node
/**
 * claude-usage-graph — turn Claude Code token usage into a 3D isometric calendar card.
 *
 *   claude-usage-graph                       # ~/.claude/projects -> claude-usage.svg
 *   claude-usage-graph -o card.svg --png     # also write card.png (needs @resvg/resvg-js)
 *   claude-usage-graph --theme github --stats
 *   claude-usage-graph --json usage.json     # render from an emitted/ccusage JSON instead
 *   claude-usage-graph --emit-json usage.json --dir ~/.claude/projects
 */
import { readFileSync, writeFileSync } from "node:fs";
import { aggregateDir, fromJson, toJson, defaultDir, grandTotal, dayTotal, type Aggregate } from "./aggregate.js";
import { renderSVG, fmt, THEMES } from "./render.js";
import { renderPNG } from "./png.js";

const VERSION = "0.1.0";
const C = { r: "\x1b[0m", b: "\x1b[1m", d: "\x1b[2m", c: "\x1b[36m", g: "\x1b[32m", y: "\x1b[33m" };
const tty = process.stdout.isTTY && process.env.NO_COLOR == null;
const p = (s: string, code: string) => (tty ? code + s + C.r : s);

function usage(): void {
  process.stdout.write(`${p("claude-usage-graph", C.b + C.c)} — Claude Code token usage → a 3D isometric calendar card

${p("USAGE", C.b)}
  claude-usage-graph [options]

${p("OPTIONS", C.b)}
  -o, --out <file>     output path (default: claude-usage.svg; .png implies --png)
      --png            also write a PNG next to the SVG (needs @resvg/resvg-js)
  -s, --scale <n>      PNG device scale (default 3 — crisp on Retina)
      --theme <name>   brand (default) · github · amber · mono
      --title <text>   header title (default "CLAUDE CODE · TOKEN USAGE")
      --dir <path>     transcripts dir (default ${p("~/.claude/projects", C.d)})
      --json <file>    render from a previously emitted/compatible JSON instead of transcripts
      --emit-json <f>  write the aggregate JSON (counts only) and exit unless also rendering
      --stats          print a usage summary to the console
  -h, --help    ·   -v, --version

${p("PRIVACY", C.b)} reads only token counts + timestamps + model id — never project names,
file paths, prompts, or message content. The output is safe to publish.
${p("https://github.com/convenientlymike/claude-usage-graph", C.d)}
`);
}

interface Args { [k: string]: string | boolean | undefined; }

function parse(argv: string[]): Args {
  const a: Args = {};
  const alias: Record<string, string> = { o: "out", s: "scale", h: "help", v: "version" };
  const bool = new Set(["png", "stats", "help", "version"]);
  for (let i = 0; i < argv.length; i++) {
    let t = argv[i];
    if (!t.startsWith("-")) continue;
    t = t.replace(/^--?/, "");
    t = alias[t] ?? t;
    if (bool.has(t)) a[t] = true;
    else a[t] = argv[++i];
  }
  return a;
}

function printStats(agg: Aggregate): void {
  const grand = grandTotal(agg);
  const [i, ou, cc, cr] = agg.totals;
  const days = Object.keys(agg.byDay).length;
  process.stdout.write(
    `\n${p("Claude Code token usage", C.b)}  ${p(agg.minDate, C.d)} → ${p(agg.maxDate, C.d)}\n` +
      `  total       ${p(fmt(grand), C.b + C.c)}  (${days} active days, ${agg.messages} turns)\n` +
      `  input ${fmt(i)} · output ${fmt(ou)} · cache-create ${fmt(cc)} · cache-read ${p(fmt(cr), C.y)}\n` +
      `  by model:\n` +
      Object.keys(agg.byModel)
        .map((m) => ({ m, t: dayTotal(agg.byModel[m]) }))
        .sort((x, y) => y.t - x.t)
        .map((x) => `    ${x.m.padEnd(22)} ${fmt(x.t)}`)
        .join("\n") +
      "\n"
  );
}

async function main(): Promise<void> {
  const a = parse(process.argv.slice(2));
  if (a.help) return usage();
  if (a.version) {
    process.stdout.write(VERSION + "\n");
    return;
  }
  if (a.theme && !THEMES[a.theme as string]) {
    process.stderr.write(`unknown theme '${a.theme}'. options: ${Object.keys(THEMES).join(", ")}\n`);
    process.exit(2);
  }

  const agg: Aggregate = a.json
    ? fromJson(JSON.parse(readFileSync(a.json as string, "utf8")))
    : aggregateDir((a.dir as string) || defaultDir());

  if (!agg.minDate) {
    process.stderr.write(
      a.json
        ? "no usage data in the supplied JSON.\n"
        : `no Claude Code usage found under ${(a.dir as string) || defaultDir()}.\n` +
            "Is this the right machine? Try --dir <path>, or --json <file>.\n"
    );
    process.exit(1);
  }

  if (a["emit-json"]) {
    writeFileSync(a["emit-json"] as string, JSON.stringify(toJson(agg)));
    process.stderr.write(`${p("✓", C.g)} wrote ${a["emit-json"]} (aggregate counts only)\n`);
    if (!a.out && !a.png) {
      if (a.stats) printStats(agg);
      return;
    }
  }

  const out = (a.out as string) || "claude-usage.svg";
  const svg = renderSVG(agg, { theme: a.theme as string, title: a.title as string });
  const svgPath = out.endsWith(".png") ? out.replace(/\.png$/, ".svg") : out;
  writeFileSync(svgPath, svg);
  process.stderr.write(`${p("✓", C.g)} wrote ${svgPath}  ${p(fmt(grandTotal(agg)) + " tokens", C.d)}\n`);

  if (a.png || out.endsWith(".png")) {
    const pngPath = out.endsWith(".png") ? out : svgPath.replace(/\.svg$/, ".png");
    const scale = a.scale ? Number(a.scale) : 3;
    try {
      writeFileSync(pngPath, await renderPNG(svg, scale));
      process.stderr.write(`${p("✓", C.g)} wrote ${pngPath}  ${p(`(${scale}×)`, C.d)}\n`);
    } catch (e) {
      process.stderr.write(`${p("✗", C.y)} ${(e as Error).message}\n`);
      process.exit(3);
    }
  }

  if (a.stats) printStats(agg);
}

main().catch((e) => {
  process.stderr.write(String((e as Error).stack || e) + "\n");
  process.exit(1);
});
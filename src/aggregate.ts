/**
 * Aggregate Claude Code token usage from local session transcripts.
 *
 * Claude Code writes one JSONL file per session under ~/.claude/projects/<project>/<id>.jsonl.
 * Each assistant turn carries `message.usage` (input / output / cache_creation / cache_read)
 * and a top-level ISO `timestamp`. We sum those into PER-DAY and PER-MODEL buckets.
 *
 * Privacy: we only ever read token COUNTS + timestamps + the model id. No project names,
 * file paths, prompts, or message content leave this module — the {@link Aggregate} it
 * returns is safe to publish.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

/** [input, output, cacheCreation, cacheRead] token counts. */
export type Quad = [number, number, number, number];

export interface Aggregate {
  /** YYYY-MM-DD -> token quad (local date). */
  byDay: Record<string, Quad>;
  /** model id -> token quad. */
  byModel: Record<string, Quad>;
  totals: Quad;
  minDate: string;
  maxDate: string;
  files: number;
  messages: number;
}

const SCHEMA_VERSION = 1;

export function defaultDir(): string {
  return join(homedir(), ".claude", "projects");
}

function zero(): Quad {
  return [0, 0, 0, 0];
}

function addInto(target: Quad, v: Quad): void {
  for (let i = 0; i < 4; i++) target[i] += v[i];
}

/** Local YYYY-MM-DD for an ISO timestamp (matches what the user sees, not UTC). */
function localDay(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Recursively collect *.jsonl files under `dir` (transcripts live one level deep, but be lenient). */
function findJsonl(dir: string, depth = 0, acc: string[] = []): string[] {
  if (depth > 4) return acc;
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return acc;
  }
  for (const name of entries) {
    const full = join(dir, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) findJsonl(full, depth + 1, acc);
    else if (name.endsWith(".jsonl")) acc.push(full);
  }
  return acc;
}

function blankAggregate(): Aggregate {
  return { byDay: {}, byModel: {}, totals: zero(), minDate: "", maxDate: "", files: 0, messages: 0 };
}

/** Parse every transcript under `dir` into an {@link Aggregate}. */
export function aggregateDir(dir: string = defaultDir()): Aggregate {
  const out = blankAggregate();
  const files = findJsonl(dir);
  out.files = files.length;
  let min: string | null = null;
  let max: string | null = null;

  for (const file of files) {
    let text: string;
    try {
      text = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    for (const line of text.split("\n")) {
      if (line.indexOf('"usage"') === -1) continue;
      let o: any;
      try {
        o = JSON.parse(line);
      } catch {
        continue;
      }
      const usage = o?.message?.usage;
      if (!usage || typeof usage !== "object") continue;
      const q: Quad = [
        usage.input_tokens || 0,
        usage.output_tokens || 0,
        usage.cache_creation_input_tokens || 0,
        usage.cache_read_input_tokens || 0,
      ];
      if (q[0] + q[1] + q[2] + q[3] === 0) continue;
      const ts = o?.timestamp;
      if (!ts) continue;
      const day = localDay(ts);
      if (!day) continue;
      if (min === null || day < min) min = day;
      if (max === null || day > max) max = day;
      const model = o?.message?.model || "unknown";
      (out.byDay[day] ??= zero()), addInto(out.byDay[day], q);
      (out.byModel[model] ??= zero()), addInto(out.byModel[model], q);
      addInto(out.totals, q);
      out.messages++;
    }
  }
  out.minDate = min ?? "";
  out.maxDate = max ?? "";
  return out;
}

/** Serializable form written by `--emit-json` and consumed by the playground / `--json`. */
export interface AggregateJson {
  version: number;
  byDay: Record<string, Quad>;
  byModel: Record<string, Quad>;
}

export function toJson(agg: Aggregate): AggregateJson {
  const byDay: Record<string, Quad> = {};
  for (const k of Object.keys(agg.byDay).sort()) byDay[k] = agg.byDay[k];
  return { version: SCHEMA_VERSION, byDay, byModel: agg.byModel };
}

/** Rebuild an {@link Aggregate} from a previously emitted JSON (or a compatible ccusage-style export). */
export function fromJson(j: AggregateJson | Record<string, Quad>): Aggregate {
  const out = blankAggregate();
  const byDay: Record<string, Quad> = (j as AggregateJson).byDay ?? (j as Record<string, Quad>);
  const byModel: Record<string, Quad> = (j as AggregateJson).byModel ?? {};
  let min: string | null = null;
  let max: string | null = null;
  for (const day of Object.keys(byDay)) {
    const q = byDay[day];
    out.byDay[day] = [q[0] || 0, q[1] || 0, q[2] || 0, q[3] || 0];
    addInto(out.totals, out.byDay[day]);
    if (min === null || day < min) min = day;
    if (max === null || day > max) max = day;
    out.messages++;
  }
  for (const m of Object.keys(byModel)) {
    const q = byModel[m];
    out.byModel[m] = [q[0] || 0, q[1] || 0, q[2] || 0, q[3] || 0];
  }
  out.minDate = min ?? "";
  out.maxDate = max ?? "";
  return out;
}

export function dayTotal(q: Quad): number {
  return q[0] + q[1] + q[2] + q[3];
}

export function grandTotal(agg: Aggregate): number {
  return dayTotal(agg.totals);
}
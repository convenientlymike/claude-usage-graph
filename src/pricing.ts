/**
 * Anthropic API list pricing → USD cost of token usage.
 *
 * Rates are USD per MILLION tokens, from the official pricing page
 * (https://platform.claude.com/docs/en/about-claude/pricing) — verified 2026-06.
 *
 * Cost model: **cache tokens are treated as OUTPUT tokens** (priced at the output
 * rate) — Anthropic's cheaper cache rates are intentionally NOT used. So:
 *
 *   cost = input × inputRate + (output + cacheCreate + cacheRead) × outputRate
 *
 * This is a list-price figure for context, not a Pro/Max subscription bill.
 */
import type { Aggregate, Quad } from "./aggregate.js";
import { dayTotal } from "./aggregate.js";

export interface Rate {
  /** USD per million input tokens. */
  input: number;
  /** USD per million output tokens (also applied to cache tokens, by design). */
  output: number;
}

// per-MTok rates (USD), verified 2026-06
const OPUS_45: Rate = { input: 5, output: 25 };
const OPUS_4: Rate = { input: 15, output: 75 };
const SONNET: Rate = { input: 3, output: 15 };
const HAIKU_45: Rate = { input: 1, output: 5 };
const HAIKU_35: Rate = { input: 0.8, output: 4 };
const FABLE5: Rate = { input: 10, output: 50 };

/** Fallback for an unrecognized model id (Sonnet-tier — a reasonable middle estimate). */
export const DEFAULT_RATE: Rate = SONNET;

/** Resolve list rates for a model id (e.g. "claude-opus-4-8", "claude-haiku-4-5-20251001"). */
export function rateFor(modelId: string): Rate {
  const m = modelId.toLowerCase();
  const v = m.match(/(\d+)[-.](\d+)/);
  const major = v ? Number(v[1]) : 0;
  const minor = v ? Number(v[2]) : 0;
  if (m.includes("opus")) return major > 4 || (major === 4 && minor >= 5) ? OPUS_45 : OPUS_4;
  if (m.includes("sonnet")) return SONNET;
  if (m.includes("haiku")) return major === 3 ? HAIKU_35 : HAIKU_45;
  if (m.includes("fable") || m.includes("mythos")) return FABLE5;
  return DEFAULT_RATE;
}

export interface CostBreakdown {
  usd: number;
  /** per-model USD, sorted desc. */
  perModel: Array<{ model: string; usd: number }>;
}

/** Cost of one model's token quad: input at input rate, everything else at output rate. */
function quadCost(q: Quad, r: Rate): number {
  const [input, output, cacheCreate, cacheRead] = q;
  return (input * r.input + (output + cacheCreate + cacheRead) * r.output) / 1e6;
}

/**
 * USD cost of an aggregate at list prices, with **cache treated as output tokens**.
 * cost = Σ_model [ input × inputRate + (output + cacheCreate + cacheRead) × outputRate ].
 */
export function computeCost(agg: Aggregate): CostBreakdown {
  const perModel: Array<{ model: string; usd: number }> = [];
  let usd = 0;
  for (const model of Object.keys(agg.byModel)) {
    const c = quadCost(agg.byModel[model], rateFor(model));
    if (c > 0) perModel.push({ model, usd: c });
    usd += c;
  }
  // If byModel is empty (e.g. a JSON without a model split) but byDay has data,
  // fall back to pricing the aggregate totals at the default rate.
  if (perModel.length === 0 && dayTotal(agg.totals) > 0) {
    usd = quadCost(agg.totals, DEFAULT_RATE);
  }
  perModel.sort((a, b) => b.usd - a.usd);
  return { usd, perModel };
}

/** "$4,920" / "$1.65M" / "$0.83" — compact USD. */
export function fmtUSD(n: number): string {
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1000) return `$${Math.round(n).toLocaleString("en-US")}`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  return `$${n.toFixed(4)}`;
}

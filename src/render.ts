/**
 * Render an {@link Aggregate} as a 3D isometric token-usage calendar SVG.
 *
 * Pure string-building — no DOM, no dependencies. The output is a self-contained,
 * native-SVG card (no `<foreignObject>`), so it renders identically on GitHub, iOS
 * Safari, and any SVG rasterizer.
 */
import type { Aggregate } from "./aggregate.js";
import { dayTotal, grandTotal } from "./aggregate.js";
import { computeCost, fmtUSD } from "./pricing.js";

export interface Theme {
  empty: string;
  ramp: [string, string, string, string];
  bg: string;
  border: string;
  txt: string;
  sub: string;
  accent: string;
  accent2: string;
  model: [string, string, string, string];
  glow1: string;
  glow2: string;
}

export const THEMES: Record<string, Theme> = {
  brand: {
    empty: "#161B22", ramp: ["#312E81", "#6366F1", "#8B5CF6", "#22D3EE"],
    bg: "#0D1117", border: "#21262D", txt: "#E6EDF3", sub: "#8B949E",
    accent: "#A78BFA", accent2: "#22D3EE", model: ["#8B5CF6", "#22D3EE", "#6366F1", "#414868"],
    glow1: "#8B5CF6", glow2: "#22D3EE",
  },
  github: {
    empty: "#161B22", ramp: ["#0E4429", "#006D32", "#26A641", "#39D353"],
    bg: "#0D1117", border: "#21262D", txt: "#E6EDF3", sub: "#8B949E",
    accent: "#39D353", accent2: "#26A641", model: ["#39D353", "#26A641", "#006D32", "#30363D"],
    glow1: "#26A641", glow2: "#39D353",
  },
  amber: {
    empty: "#1A140B", ramp: ["#7C4A03", "#B45309", "#F59E0B", "#FCD34D"],
    bg: "#0C0A07", border: "#292015", txt: "#FDF6E3", sub: "#A89878",
    accent: "#FCD34D", accent2: "#F59E0B", model: ["#F59E0B", "#FCD34D", "#B45309", "#44372A"],
    glow1: "#F59E0B", glow2: "#FCD34D",
  },
  mono: {
    empty: "#161B22", ramp: ["#30363D", "#57606A", "#8B949E", "#E6EDF3"],
    bg: "#0D1117", border: "#21262D", txt: "#E6EDF3", sub: "#8B949E",
    accent: "#E6EDF3", accent2: "#8B949E", model: ["#E6EDF3", "#8B949E", "#57606A", "#30363D"],
    glow1: "#57606A", glow2: "#8B949E",
  },
};

export interface RenderOptions {
  theme?: string;
  title?: string;
  /** Show the USD cost figure on the card: "on" (default) · "off". */
  costMode?: "on" | "off";
  /** Override the "now" used for the footer date (mainly for deterministic tests). */
  now?: Date;
}

const SANS = "-apple-system,'Segoe UI',Helvetica,Arial,sans-serif";
const MONO = "'SF Mono','JetBrains Mono',ui-monospace,Menlo,monospace";

// ---- isometric cube geometry ----
const TW = 22;
const TH = 12;
const HMIN = 3;
const HMAX = 58;

export function fmt(n: number): string {
  n = Number(n);
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(Math.round(n));
}

function darken(hex: string, f: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const h = (x: number) => Math.max(0, Math.min(255, Math.round(x * f))).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

function color(val: number, mx: number, t: Theme): string {
  if (val <= 0 || mx <= 0) return t.empty;
  const f = Math.sqrt(val / mx);
  if (f < 0.12) return t.ramp[0];
  if (f < 0.34) return t.ramp[1];
  if (f < 0.62) return t.ramp[2];
  return t.ramp[3];
}

function cubeHeight(val: number, mx: number): number {
  if (val <= 0 || mx <= 0) return HMIN;
  return HMIN + (HMAX - HMIN) * Math.sqrt(val / mx);
}

function esc(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function cube(cx: number, cy: number, h: number, top: string): string {
  const left = darken(top, 0.7);
  const right = darken(top, 0.52);
  const Rb: [number, number] = [cx + TW / 2, cy];
  const Bb: [number, number] = [cx, cy + TH / 2];
  const Lb: [number, number] = [cx - TW / 2, cy];
  const Tt: [number, number] = [cx, cy - TH / 2 - h];
  const Rt: [number, number] = [cx + TW / 2, cy - h];
  const Bt: [number, number] = [cx, cy + TH / 2 - h];
  const Lt: [number, number] = [cx - TW / 2, cy - h];
  const P = (...pts: [number, number][]) =>
    "M" + pts.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" L") + " Z";
  return (
    `<path d="${P(Lt, Bt, Bb, Lb)}" fill="${left}"/>` +
    `<path d="${P(Rt, Bt, Bb, Rb)}" fill="${right}"/>` +
    `<path d="${P(Tt, Rt, Bt, Lt)}" fill="${top}" stroke="${darken(top, 0.85)}" stroke-width="0.5"/>`
  );
}

function prettyModel(id: string): string {
  let m = id.match(/(opus|sonnet|haiku)[-_]?(\d+)[-_.](\d+)/i);
  if (m) return `${m[1][0].toUpperCase()}${m[1].slice(1)} ${m[2]}.${m[3]}`;
  m = id.match(/(opus|sonnet|haiku)/i);
  if (m) return `${m[1][0].toUpperCase()}${m[1].slice(1)}`;
  if (id === "unknown") return "Other";
  return id.replace(/^claude[-_]?/i, "").replace(/[-_]/g, " ") || id;
}

function diffDays(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
}

/** Monday-indexed weekday (Mon=0..Sun=6) for a YYYY-MM-DD string. */
function mondayWeekday(day: string): number {
  const d = new Date(day + "T00:00:00");
  return (d.getDay() + 6) % 7;
}

function monthAbbr(day: string): string {
  return ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][
    Number(day.slice(5, 7)) - 1
  ];
}

export function renderSVG(agg: Aggregate, opts: RenderOptions = {}): string {
  const t = THEMES[opts.theme ?? "brand"] ?? THEMES.brand;
  const grand = grandTotal(agg);
  const dayTotals: Record<string, number> = {};
  for (const k of Object.keys(agg.byDay)) dayTotals[k] = dayTotal(agg.byDay[k]);
  const activeDays = Object.keys(dayTotals).length;

  let peakK = agg.minDate;
  let peakV = 0;
  for (const k of Object.keys(dayTotals)) if (dayTotals[k] > peakV) (peakV = dayTotals[k]), (peakK = k);
  const mx = peakV || 1;

  const spanDays = agg.minDate && agg.maxDate ? diffDays(agg.minDate, agg.maxDate) + 1 : 1;
  const avg = grand / spanDays;

  // grid: Monday on/before minDate
  const startWeekday = mondayWeekday(agg.minDate);
  const startMs = Date.parse(agg.minDate + "T00:00:00") - startWeekday * 86400000;

  interface Pt { col: number; row: number; val: number; sx: number; sy: number; h: number; }
  const pts: Pt[] = [];
  let xMin = 0, xMax = 0, yMin = 0, yMax = 0;
  for (const day of Object.keys(dayTotals)) {
    const off = Math.round((Date.parse(day + "T00:00:00") - startMs) / 86400000);
    const col = Math.floor(off / 7);
    const row = mondayWeekday(day);
    const val = dayTotals[day];
    const sx = (col - row) * TW / 2;
    const sy = (col + row) * TH / 2;
    const h = cubeHeight(val, mx);
    pts.push({ col, row, val, sx, sy, h });
    xMin = Math.min(xMin, sx - TW / 2); xMax = Math.max(xMax, sx + TW / 2);
    yMin = Math.min(yMin, sy - TH / 2 - h); yMax = Math.max(yMax, sy + TH / 2);
  }
  const isoW = xMax - xMin;
  const isoH = yMax - yMin;

  const PAD = 24;
  const headerH = 150;
  const footerH = 30;
  const cardW = Math.max(560, Math.round(isoW + 2 * PAD + 40));
  const isoAreaH = Math.round(isoH + 30);
  const cardH = headerH + isoAreaH + footerH;
  const ox = (cardW - isoW) / 2 - xMin;
  const oy = headerH + 18 - yMin;

  pts.sort((a, b) => (a.col + a.row) - (b.col + b.row) || a.row - b.row);

  // model split (generic: top buckets by total). Percentages are taken against the
  // SUM of model totals (not the day grand) so they stay sane even if byModel and
  // byDay disagree; for real data the two are equal.
  const modelSum = Object.keys(agg.byModel).reduce((s, m) => s + dayTotal(agg.byModel[m]), 0) || 1;
  const modelTotals = Object.keys(agg.byModel)
    .map((m) => ({ label: prettyModel(m), total: dayTotal(agg.byModel[m]) }))
    .filter((m) => m.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 4);

  const o: string[] = [];
  o.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${cardW}" height="${cardH}" viewBox="0 0 ${cardW} ${cardH}" font-family="${SANS}">`
  );
  o.push(
    "<defs>" +
      `<radialGradient id="g1" cx="0%" cy="0%" r="120%"><stop offset="0%" stop-color="${t.glow1}" stop-opacity="0.16"/><stop offset="55%" stop-color="${t.bg}" stop-opacity="0"/></radialGradient>` +
      `<radialGradient id="g2" cx="100%" cy="100%" r="120%"><stop offset="0%" stop-color="${t.glow2}" stop-opacity="0.13"/><stop offset="55%" stop-color="${t.bg}" stop-opacity="0"/></radialGradient>` +
      "</defs>"
  );
  for (const fill of [t.bg, "url(#g1)", "url(#g2)"]) {
    o.push(`<rect x="1" y="1" width="${cardW - 2}" height="${cardH - 2}" rx="14" fill="${fill}"${fill === t.bg ? ` stroke="${t.border}"` : ""}/>`);
  }

  // header
  const title = opts.title ?? "CLAUDE CODE · TOKEN USAGE";
  o.push(`<rect x="${PAD}" y="30" width="9" height="9" rx="2" fill="${t.accent2}"/>`);
  o.push(`<text x="${PAD + 16}" y="38" fill="${t.accent}" font-size="13" font-weight="700" letter-spacing="2">${esc(title)}</text>`);
  o.push(`<text x="${PAD}" y="84" fill="${t.accent2}" font-family="${MONO}" font-size="44" font-weight="700">${fmt(grand)}</text>`);
  const bnW = fmt(grand).length * 26;
  o.push(`<text x="${PAD + bnW + 8}" y="84" fill="${t.sub}" font-size="16">tokens</text>`);

  // USD figure (cache priced as output, per pricing.ts). By design, NO pricing/basis
  // caveat is printed on the card itself; just the dollar number next to the tokens.
  const cost = opts.costMode === "off" ? null : computeCost(agg);
  if (cost) {
    const ux = PAD + bnW + 8 + 52;
    o.push(`<text x="${ux}" y="84" fill="${t.accent}" font-family="${MONO}" font-size="28" font-weight="700">${esc(fmtUSD(cost.usd))}</text>`);
  }

  const sub = `since ${monthAbbr(agg.minDate)} ${Number(agg.minDate.slice(8, 10))}, ${agg.minDate.slice(0, 4)} · ${activeDays} active days · ~${fmt(avg)}/day · peak ${Number(peakK.slice(5, 7))}/${Number(peakK.slice(8, 10))} ${fmt(peakV)}`;
  o.push(`<text x="${PAD}" y="108" fill="${t.sub}" font-size="12.5">${esc(sub)}</text>`);

  // model split stacked bar + legend
  const mbX = PAD, mbY = 122, mbW = Math.min(360, cardW - 2 * PAD), mbH = 9;
  o.push(`<rect x="${mbX}" y="${mbY}" width="${mbW}" height="${mbH}" rx="4" fill="${t.empty}"/>`);
  let x = mbX;
  modelTotals.forEach((m, i) => {
    const w = (mbW * m.total) / modelSum;
    o.push(`<rect x="${x.toFixed(1)}" y="${mbY}" width="${Math.max(0, w).toFixed(1)}" height="${mbH}" fill="${t.model[i]}"/>`);
    x += w;
  });
  let lx = mbX;
  const ly = mbY + mbH + 16;
  modelTotals.forEach((m, i) => {
    const pct = (100 * m.total) / modelSum;
    const lab = `${m.label} ${pct.toFixed(0)}%`;
    o.push(`<rect x="${lx}" y="${ly - 8}" width="8" height="8" rx="2" fill="${t.model[i]}"/>`);
    o.push(`<text x="${lx + 12}" y="${ly}" fill="${t.sub}" font-size="11">${esc(lab)}</text>`);
    lx += 14 + lab.length * 6.4 + 14;
  });

  // isometric calendar
  o.push(`<g transform="translate(${ox.toFixed(2)},${oy.toFixed(2)})">`);
  for (const p of pts) o.push(cube(p.sx, p.sy, p.h, color(p.val, mx, t)));
  o.push("</g>");

  // footer: legend + updated
  const legY = cardH - 16;
  o.push(`<text x="${PAD}" y="${legY}" fill="${t.sub}" font-size="11">less</text>`);
  let sx2 = PAD + 30;
  for (const c of [t.empty, ...t.ramp]) {
    o.push(`<rect x="${sx2}" y="${legY - 9}" width="11" height="11" rx="2" fill="${c}"/>`);
    sx2 += 14;
  }
  o.push(`<text x="${sx2 + 2}" y="${legY}" fill="${t.sub}" font-size="11">more</text>`);
  const now = opts.now ?? new Date();
  const gen = `${monthAbbr(now.toISOString())} ${now.getDate()}, ${now.getFullYear()}`;
  o.push(`<text x="${cardW - PAD}" y="${legY}" fill="${darken(t.sub, 0.7)}" font-size="10.5" text-anchor="end">aggregate counts · updated ${gen}</text>`);

  o.push("</svg>");
  return o.join("\n");
}
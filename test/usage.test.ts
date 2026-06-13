import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import {
  aggregateDir,
  fromJson,
  toJson,
  grandTotal,
  dayTotal,
  renderSVG,
  renderPNG,
  THEMES,
  type AggregateJson,
} from "../src/index.js";

const fixtures = fileURLToPath(new URL("./fixtures", import.meta.url));

test("aggregateDir sums usage and ignores non-usage / zero lines (tz-independent)", () => {
  const agg = aggregateDir(fixtures);
  // 3 lines carry non-zero usage; the user line and the all-zero line are skipped.
  assert.equal(agg.messages, 3);
  // total = (100+200+50+1000) + (10+20+5+100) + (1+2+0+5000) = 6488
  assert.equal(grandTotal(agg), 6488);
  assert.equal(dayTotal(agg.byModel["claude-opus-4-8"]), 6353);
  assert.equal(dayTotal(agg.byModel["claude-sonnet-4-6"]), 135);
  assert.ok(agg.minDate && agg.maxDate, "has a date range");
});

const SAMPLE: AggregateJson = {
  version: 1,
  byDay: {
    "2026-05-04": [10, 20, 30, 4000],
    "2026-05-05": [5, 10, 10, 800],
    "2026-05-07": [1, 2, 3, 50],
  },
  byModel: {
    "claude-opus-4-8": [12, 24, 36, 4500],
    "claude-sonnet-4-6": [4, 8, 7, 350],
  },
};

test("fromJson / toJson round-trip preserves totals", () => {
  const agg = fromJson(SAMPLE);
  assert.equal(grandTotal(agg), 10 + 20 + 30 + 4000 + 5 + 10 + 10 + 800 + 1 + 2 + 3 + 50);
  const j = toJson(agg);
  assert.deepEqual(j.byDay["2026-05-04"], [10, 20, 30, 4000]);
  // keys are sorted
  assert.deepEqual(Object.keys(j.byDay), ["2026-05-04", "2026-05-05", "2026-05-07"]);
});

test("renderSVG produces a well-formed card with one cube (3 faces) per active day", () => {
  const agg = fromJson(SAMPLE);
  const svg = renderSVG(agg, { now: new Date("2026-06-12T00:00:00Z") });
  assert.ok(svg.startsWith("<svg"), "starts with <svg");
  assert.ok(svg.trimEnd().endsWith("</svg>"), "ends with </svg>");
  // 3 active days × 3 faces (top/left/right) = 9 cube paths
  const faces = (svg.match(/<path /g) || []).length;
  assert.equal(faces, 9);
  // headline total formatted (4936 -> "4.9K")
  assert.ok(svg.includes("4.9K"), "shows the formatted total");
  // model split labels
  assert.ok(svg.includes("Opus 4.8"), "pretty model label");
  assert.ok(svg.includes("Sonnet 4.6"));
});

test("every theme renders", () => {
  const agg = fromJson(SAMPLE);
  for (const name of Object.keys(THEMES)) {
    const svg = renderSVG(agg, { theme: name });
    assert.ok(svg.includes(THEMES[name].ramp[3]), `${name} uses its ramp`);
  }
});

test("renderPNG works when @resvg/resvg-js is available (else skips)", async (t) => {
  const agg = fromJson(SAMPLE);
  const svg = renderSVG(agg);
  let png: Uint8Array;
  try {
    png = await renderPNG(svg, 2);
  } catch (e) {
    t.skip("@resvg/resvg-js not installed: " + (e as Error).message.split("\n")[0]);
    return;
  }
  assert.ok(png.length > 1000, "non-trivial PNG");
  // PNG magic number
  assert.deepEqual([...png.slice(0, 4)], [0x89, 0x50, 0x4e, 0x47]);
});

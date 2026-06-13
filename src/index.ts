/**
 * claude-usage-graph — library API.
 *
 * @example
 * import { aggregateDir, renderSVG } from "claude-usage-graph";
 * const agg = aggregateDir();              // parse ~/.claude/projects
 * const svg = renderSVG(agg, { theme: "brand" });
 */
export {
  aggregateDir,
  fromJson,
  toJson,
  defaultDir,
  dayTotal,
  grandTotal,
  type Aggregate,
  type AggregateJson,
  type Quad,
} from "./aggregate.js";

export { renderSVG, fmt, THEMES, type Theme, type RenderOptions } from "./render.js";
export { renderPNG } from "./png.js";
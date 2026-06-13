/**
 * Optional PNG rasterization via `@resvg/resvg-js` (a pure, cross-OS native renderer —
 * no browser, no system libraries). It's an OPTIONAL dependency: the SVG path needs
 * nothing, and `--png` loads resvg lazily with a friendly message if it's absent.
 */
export async function renderPNG(svg: string, scale = 3): Promise<Uint8Array> {
  let mod: typeof import("@resvg/resvg-js");
  try {
    mod = await import("@resvg/resvg-js");
  } catch {
    throw new Error(
      "PNG output needs the optional '@resvg/resvg-js' package.\n" +
        "  Install it:  npm i @resvg/resvg-js   (or pnpm add @resvg/resvg-js)\n" +
        "Or omit --png — the SVG renders identically everywhere (GitHub, iOS, etc.)."
    );
  }
  const resvg = new mod.Resvg(svg, {
    fitTo: { mode: "zoom", value: scale },
    background: "rgba(0,0,0,0)", // transparent — the card draws its own rounded panel
    font: { loadSystemFonts: true },
  });
  return resvg.render().asPng();
}
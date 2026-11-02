// Renders the site-wide Open Graph card to public/og.png.
//
// One card for every page: the mark, the name, and the one-line description
// the home page carries. It is drawn by the same Chromium Playwright tests
// with, from an HTML string, so the type is the site's own Geist rather than
// whatever a rasterizer's font config happens to find. Run it again when the
// mark, the name, or the description changes:
//
//   pnpm run og
//
// The fonts are read from Astro's build-time cache (`.astro/fonts`), which a
// `pnpm run build` fills. Without them the card falls back to the system
// sans, which is fine for a check and wrong for a commit, so the script says
// which it used.
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "public", "og.png");

const WIDTH = 1200;
const HEIGHT = 630;
// --background and --foreground under .dark (src/styles/global.css), as sRGB.
const BACKGROUND = "#0a0a0a";
const FOREGROUND = "#fafafa";
const MUTED = "#a1a1a1";

/** The Geist faces as data URLs, or none when the cache is empty. */
function fonts() {
  const dir = join(root, ".astro", "fonts");
  let files = [];
  try {
    files = readdirSync(dir);
  } catch {
    return [];
  }
  const face = (family, prefix) => {
    const file = files.find(
      (name) => name.startsWith(prefix) && name.endsWith(".woff2"),
    );
    if (!file) return null;
    const data = readFileSync(join(dir, file)).toString("base64");
    return `@font-face { font-family: "${family}"; font-weight: 100 900; src: url(data:font/woff2;base64,${data}) format("woff2"); }`;
  };
  return [
    face("Geist", "font-geist-sans-100-900-normal-latin-"),
    face("Geist Mono", "font-geist-mono-100-900-normal-latin-"),
  ].filter(Boolean);
}

const faces = fonts();

/** The mark from public/favicon.svg, in the foreground color. */
const mark = readFileSync(join(root, "public", "favicon.svg"), "utf8")
  .replace(/<style>[\s\S]*?<\/style>/, "")
  .replace(
    "<g ",
    `<g fill="none" stroke="${FOREGROUND}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" `,
  );

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>
${faces.join("\n")}
* { margin: 0; box-sizing: border-box; }
html, body { width: ${WIDTH}px; height: ${HEIGHT}px; overflow: hidden; }
body {
  background: ${BACKGROUND};
  color: ${FOREGROUND};
  font-family: Geist, ui-sans-serif, system-ui, sans-serif;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 72px 80px;
  -webkit-font-smoothing: antialiased;
}
svg { width: 96px; height: 96px; display: block; }
h1 { font-size: 84px; font-weight: 500; letter-spacing: -0.03em; line-height: 1.05; }
p { margin-top: 20px; font-size: 38px; color: ${MUTED}; letter-spacing: -0.01em; }
footer { font-family: "Geist Mono", ui-monospace, monospace; font-size: 26px; color: ${MUTED}; }
</style>
</head>
<body>
  ${mark}
  <div>
    <h1>Jamie Thompson</h1>
    <p>Design engineer who owns the finish layer.</p>
  </div>
  <footer>jamiethompson.dev</footer>
</body>
</html>`;

const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 1,
  });
  await page.setContent(html, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: out, type: "png" });
} finally {
  await browser.close();
}

console.log(
  `Wrote ${out} (${WIDTH}×${HEIGHT}) with ${faces.length === 2 ? "Geist" : "the system sans: run pnpm run build first for Geist"}.`,
);

import { describe, expect, it } from "vitest";
import astroConfig from "../../astro.config";

/** Through the processor `astro.config.ts` wires up, as markdown is built. */
const renderer = await astroConfig.markdown!.processor!.createRenderer({});

const TABLE = "| a | b |\n| - | - |\n| 1 | 2 |\n";

describe("rehypeScrollTables", () => {
  it("wraps a table in a focusable, named scroll region", async () => {
    const { code } = await renderer.render(TABLE, {});
    expect(code).toMatch(
      /^<div class="table-scroll" role="region" aria-label="Table" tabindex="0">\s*<table>/,
    );
    expect(code.trimEnd()).toMatch(/<\/table>\s*<\/div>$/);
  });

  it("wraps each table once", async () => {
    const { code } = await renderer.render(`${TABLE}\n${TABLE}`, {});
    expect(code.match(/class="table-scroll"/g)).toHaveLength(2);
    expect(code).not.toMatch(/table-scroll"[^>]*>\s*<div class="table-scroll"/);
  });

  it("leaves markdown without tables alone", async () => {
    const { code } = await renderer.render("Just a paragraph.", {});
    expect(code).not.toContain("table-scroll");
  });
});

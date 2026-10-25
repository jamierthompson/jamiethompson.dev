import { describe, expect, it } from "vitest";
import { buildToc } from "./toc";

const h = (depth: number, text: string) => ({
  depth,
  text,
  slug: text.toLowerCase().replace(/\s+/g, "-"),
});

describe("buildToc", () => {
  it("is empty for a page with no headings", () => {
    expect(buildToc([])).toEqual([]);
  });

  it("nests each h3 under the h2 before it", () => {
    expect(
      buildToc([h(2, "One"), h(3, "One a"), h(3, "One b"), h(2, "Two")]),
    ).toEqual([
      {
        slug: "one",
        text: "One",
        children: [
          { slug: "one-a", text: "One a", children: [] },
          { slug: "one-b", text: "One b", children: [] },
        ],
      },
      { slug: "two", text: "Two", children: [] },
    ]);
  });

  it("leaves out the h1 and anything deeper than h3", () => {
    expect(buildToc([h(1, "Title"), h(2, "Two"), h(4, "Four")])).toEqual([
      { slug: "two", text: "Two", children: [] },
    ]);
  });

  it("keeps an h3 that comes before any h2 at the top level", () => {
    expect(buildToc([h(3, "Orphan"), h(2, "Two")])).toEqual([
      { slug: "orphan", text: "Orphan", children: [] },
      { slug: "two", text: "Two", children: [] },
    ]);
  });

  it("leaves out the hidden heading GFM adds above footnotes", () => {
    expect(
      buildToc([
        h(2, "Two"),
        { depth: 2, text: "Footnotes", slug: "footnote-label" },
      ]),
    ).toEqual([{ slug: "two", text: "Two", children: [] }]);
  });
});

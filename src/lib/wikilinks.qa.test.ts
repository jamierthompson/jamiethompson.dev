/**
 * Adversarial QA additions for the wikilink pipeline.
 *
 * The load-bearing claim under test: `extractWikiTargets` (a regex over raw
 * markdown, used to build the "Referenced by" index) must agree with what the
 * real remark-wiki-link parser actually renders as an anchor. Where the two
 * disagree, the backlink index lists entries that never link anywhere — a
 * phantom "Referenced by" row.
 *
 * Tests in the "defects" block FAIL against the current implementation on
 * purpose; each one pins a confirmed divergence (verified against the built
 * site and against remark-wiki-link@2.0.1's tokenizer, which rejects these
 * forms). They are the acceptance criteria for the fix.
 */
import { describe, expect, it } from "vitest";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import { wikiLinkPlugin } from "remark-wiki-link";
import {
  buildBacklinkIndex,
  extractWikiTargets,
  wikiLinkOptions,
  type LinkedEntry,
} from "./wikilinks";

const render = async (md: string): Promise<string> => {
  const file = await unified()
    .use(remarkParse)
    .use(wikiLinkPlugin, wikiLinkOptions)
    .use(remarkRehype)
    .use(rehypeStringify)
    .process(md);
  return String(file);
};

describe("defects: extractWikiTargets counts links the parser never renders", () => {
  it("ignores wikilinks inside fenced code blocks", async () => {
    const md = "A sample:\n\n```\n[[The QA Rule]]\n```\n";
    // The parser renders the fence literally — no anchor:
    expect(await render(md)).not.toContain("<a ");
    // …so the backlink extractor must not count it either:
    expect(extractWikiTargets(md)).toEqual([]);
  });

  it("ignores wikilinks inside inline code", async () => {
    const md = "Type `[[The QA Rule]]` to link.";
    expect(await render(md)).not.toContain("<a ");
    expect(extractWikiTargets(md)).toEqual([]);
  });

  it("ignores [[target|]] with an empty alias, which the parser rejects", async () => {
    const md = "Broken: [[the-qa-rule|]].";
    expect(await render(md)).not.toContain("<a ");
    expect(extractWikiTargets(md)).toEqual([]);
  });

  it("ignores a target broken across a line ending, which the parser rejects", async () => {
    const md = "Broken: [[the\nqa rule]].";
    expect(await render(md)).not.toContain("<a ");
    expect(extractWikiTargets(md)).toEqual([]);
  });

  it("ignores whitespace-only targets, which the parser rejects", async () => {
    const md = "Broken: [[ ]].";
    expect(await render(md)).not.toContain("<a ");
    // Current code emits a backlink keyed on the empty string.
    expect(extractWikiTargets(md)).toEqual([]);
  });

  it("does not index a phantom backlink from a code sample", () => {
    const entries: LinkedEntry[] = [
      { collection: "notes", id: "target", title: "Target", body: "prose" },
      {
        collection: "notes",
        id: "sample",
        title: "Sample",
        body: "```\n[[target]]\n```",
      },
    ];
    expect(buildBacklinkIndex(entries).get("target")).toBeUndefined();
  });
});

describe("edge coverage: extractor and parser agree", () => {
  it("keeps the first divider as the target/alias split for [[a|b|c]]", async () => {
    const html = await render("See [[a|b|c]].");
    expect(html).toContain('href="/notes/a/"');
    expect(html).toContain(">b|c</a>");
    expect(extractWikiTargets("See [[a|b|c]].")).toEqual(["a"]);
  });

  it("de-duplicates targets that differ only by case", () => {
    expect(extractWikiTargets("[[The QA Rule]] and [[the qa rule]]")).toEqual([
      "the-qa-rule",
    ]);
  });

  it("returns no targets for an empty body", () => {
    expect(extractWikiTargets("")).toEqual([]);
  });

  it("collapses runs of whitespace to a single dash", async () => {
    expect(extractWikiTargets("[[the   qa   rule]]")).toEqual(["the-qa-rule"]);
    expect(await render("[[the   qa   rule]]")).toContain(
      'href="/notes/the-qa-rule/"',
    );
  });

  it("only exempts a NOTE from self-backlinks — an essay with the same id still counts", () => {
    const entries: LinkedEntry[] = [
      { collection: "notes", id: "x", title: "Note X", body: "no links" },
      { collection: "essays", id: "x", title: "Essay X", body: "see [[x]]" },
    ];
    expect(buildBacklinkIndex(entries).get("x")).toEqual([
      { collection: "essays", id: "x", title: "Essay X" },
    ]);
  });

  it("aggregates multiple distinct sources in entry order", () => {
    const entries: LinkedEntry[] = [
      { collection: "notes", id: "a", title: "A", body: "[[t]]" },
      { collection: "notes", id: "b", title: "B", body: "[[t]] and [[t]]" },
      { collection: "essays", id: "c", title: "C", body: "[[T]]" },
    ];
    const sources = buildBacklinkIndex(entries).get("t");
    expect(sources?.map((s) => s.id)).toEqual(["a", "b", "c"]);
  });
});

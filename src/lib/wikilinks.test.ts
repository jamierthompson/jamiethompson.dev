import { describe, expect, it } from "vitest";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import { wikiLinkPlugin } from "remark-wiki-link";
import {
  buildBacklinkIndex,
  extractWikiTargets,
  slugifyWikiTarget,
  wikiLinkOptions,
  type LinkedEntry,
} from "./wikilinks";

describe("slugifyWikiTarget", () => {
  it("lower-cases and kebab-cases spaces", () => {
    expect(slugifyWikiTarget("The QA Rule")).toBe("the-qa-rule");
  });

  it("leaves an already-kebab slug alone", () => {
    expect(slugifyWikiTarget("the-qa-rule")).toBe("the-qa-rule");
  });

  it("trims surrounding whitespace before slugifying", () => {
    expect(slugifyWikiTarget("  padded name ")).toBe("padded-name");
  });
});

describe("extractWikiTargets", () => {
  it("finds plain and aliased links", () => {
    const md = "See [[the-qa-rule]] and [[Skill Eval|the eval that lost]].";
    expect(extractWikiTargets(md)).toEqual(["the-qa-rule", "skill-eval"]);
  });

  it("de-duplicates repeated targets", () => {
    expect(extractWikiTargets("[[a]] then [[a]] again")).toEqual(["a"]);
  });

  it("returns empty for prose without wikilinks", () => {
    expect(extractWikiTargets("No [links](here), only markdown.")).toEqual([]);
  });
});

describe("buildBacklinkIndex", () => {
  const entries: LinkedEntry[] = [
    {
      collection: "notes",
      id: "a",
      title: "Note A",
      body: "points at [[b]] and itself via [[a]]",
    },
    { collection: "notes", id: "b", title: "Note B", body: "no links" },
    { collection: "essays", id: "e", title: "Essay E", body: "cites [[b]]" },
  ];

  it("collects every entry linking to a target", () => {
    const index = buildBacklinkIndex(entries);
    expect(index.get("b")).toEqual([
      { collection: "notes", id: "a", title: "Note A" },
      { collection: "essays", id: "e", title: "Essay E" },
    ]);
  });

  it("ignores a note linking to itself", () => {
    const index = buildBacklinkIndex(entries);
    expect(index.get("a")).toBeUndefined();
  });
});

describe("rendered output through the real remark pipeline", () => {
  const render = async (md: string): Promise<string> => {
    const file = await unified()
      .use(remarkParse)
      .use(wikiLinkPlugin, wikiLinkOptions)
      .use(remarkRehype)
      .use(rehypeStringify)
      .process(md);
    return String(file);
  };

  it("renders [[target]] as an anchor into /notes/", async () => {
    const html = await render("See [[The QA Rule]].");
    expect(html).toContain('href="/notes/the-qa-rule/"');
    expect(html).toContain(">The QA Rule</a>");
  });

  it("renders the alias as the link text", async () => {
    const html = await render("See [[the-qa-rule|the rule]].");
    expect(html).toContain('href="/notes/the-qa-rule/"');
    expect(html).toContain(">the rule</a>");
  });
});

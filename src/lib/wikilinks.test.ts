import { describe, expect, it } from "vitest";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import { wikiLinkPlugin } from "remark-wiki-link";
import {
  buildBacklinkIndex,
  buildReferenceIndex,
  extractInternalLinkTargets,
  extractWikiTargets,
  referenceKey,
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

describe("extractInternalLinkTargets", () => {
  it("finds links into every collection, with or without trailing slash", () => {
    const md =
      "Read [the essay](/essays/the-qa-rule/), [a note](/notes/no-prior-context) " +
      "and [the run](/experiments/agent-team-skill-eval/).";
    expect(extractInternalLinkTargets(md)).toEqual([
      "essays/the-qa-rule",
      "notes/no-prior-context",
      "experiments/agent-team-skill-eval",
    ]);
  });

  it("ignores external URLs, index pages, and unknown paths", () => {
    const md =
      "See [GitHub](https://github.com/jamierthompson/digital-garden), " +
      "[all notes](/notes/), and [about](/about/).";
    expect(extractInternalLinkTargets(md)).toEqual([]);
  });

  it("ignores links inside code fences and inline code", () => {
    const md =
      "```md\n[fenced](/essays/fenced/)\n```\n" +
      "and `[inline](/notes/inline/)` stay text.";
    expect(extractInternalLinkTargets(md)).toEqual([]);
  });

  it("de-duplicates repeated targets", () => {
    const md = "[once](/essays/a/) and [twice](/essays/a/)";
    expect(extractInternalLinkTargets(md)).toEqual(["essays/a"]);
  });
});

describe("buildReferenceIndex", () => {
  const entry = (
    collection: LinkedEntry["collection"],
    id: string,
    body: string,
  ): LinkedEntry => ({ collection, id, title: `title:${id}`, body });

  it("indexes wikilink references under the notes namespace", () => {
    const index = buildReferenceIndex([
      entry("essays", "an-essay", "cites [[a-note]]"),
    ]);
    expect(index.get(referenceKey("notes", "a-note"))).toEqual([
      { collection: "essays", id: "an-essay", title: "title:an-essay" },
    ]);
  });

  it("indexes internal-link references to essays and experiments", () => {
    const index = buildReferenceIndex([
      entry(
        "notes",
        "a-note",
        "full run at [the eval](/experiments/the-eval/)",
      ),
      entry("notes", "b-note", "argued in [the essay](/essays/the-essay/)"),
    ]);
    expect(index.get(referenceKey("experiments", "the-eval"))).toEqual([
      { collection: "notes", id: "a-note", title: "title:a-note" },
    ]);
    expect(index.get(referenceKey("essays", "the-essay"))).toEqual([
      { collection: "notes", id: "b-note", title: "title:b-note" },
    ]);
  });

  it("drops self-references and collapses repeat links from one source", () => {
    const index = buildReferenceIndex([
      entry(
        "notes",
        "self",
        "[[self]] and [me](/notes/self/), plus [[other]] and [other again](/notes/other/)",
      ),
    ]);
    expect(index.get(referenceKey("notes", "self"))).toBeUndefined();
    expect(index.get(referenceKey("notes", "other"))).toEqual([
      { collection: "notes", id: "self", title: "title:self" },
    ]);
  });

  it("does not conflate same ids across collections", () => {
    const index = buildReferenceIndex([
      entry("notes", "a", "[link](/essays/shared/)"),
      entry("notes", "b", "[link](/experiments/shared/)"),
    ]);
    expect(index.get(referenceKey("essays", "shared"))).toHaveLength(1);
    expect(index.get(referenceKey("experiments", "shared"))).toHaveLength(1);
  });
});

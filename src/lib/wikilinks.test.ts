import { describe, expect, it } from "vitest";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import { wikiLinkPlugin } from "remark-wiki-link";
import {
  buildBacklinkIndex,
  buildReferenceIndex,
  entryFormatFromPath,
  extractInternalLinkTargets,
  extractWikiTargets,
  referenceKey,
  slugifyWikiTarget,
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

describe("slugification is lossy in ways both sides share", () => {
  it("collapses [[C++]] and [[C]] onto one target", async () => {
    const md = "[[C++]] and [[C]]";
    const html = await render(md);
    expect(html.match(/href="\/notes\/c\/"/g)).toHaveLength(2);
    expect(extractWikiTargets(md)).toEqual(["c"]);
  });

  it("keeps non-ASCII letters in the slug", async () => {
    expect(extractWikiTargets("[[Café]]")).toEqual(["café"]);
    expect(await render("[[Café]]")).toContain('href="/notes/café/"');
  });

  it("swallows a # fragment into the target rather than splitting on it", async () => {
    const md = "[[target#a-heading]]";
    expect(extractWikiTargets(md)).toEqual(["targeta-heading"]);
    expect(await render(md)).toContain('href="/notes/targeta-heading/"');
  });
});

/**
 * This switch decides which grammar runs. Anything that is not exactly `.mdx`
 * has to land on markdown rather than throwing: MDX is not a superset and
 * throws on ordinary prose, so guessing MDX for an unrecognized path is the
 * expensive mistake.
 */
describe("entryFormatFromPath", () => {
  it("reads the two extensions the loaders glob", () => {
    expect(entryFormatFromPath("src/content/notes/a-note.md")).toBe("md");
    expect(entryFormatFromPath("src/content/notes/a-note.mdx")).toBe("mdx");
  });

  it("has no opinion when the loader stored no path", () => {
    expect(entryFormatFromPath(undefined)).toBeUndefined();
  });

  it("treats .MDX as markdown, the way Astro's exact extension map does", () => {
    expect(entryFormatFromPath("src/content/notes/a-note.MDX")).toBe("md");
  });

  it("does not read .mdx in a directory name as the extension", () => {
    expect(entryFormatFromPath("src/content/notes/about.mdx/index.md")).toBe(
      "md",
    );
  });

  it("falls back to markdown for a path with no extension", () => {
    expect(entryFormatFromPath("src/content/notes/README")).toBe("md");
  });
});

describe("extractWikiTargets", () => {
  it("finds plain and aliased links", () => {
    const md = "See [[the-qa-rule]] and [[Skill Eval|the eval that lost]].";
    expect(extractWikiTargets(md)).toEqual(["the-qa-rule", "skill-eval"]);
  });

  it("de-duplicates repeated wikilink targets", () => {
    expect(extractWikiTargets("[[a]] then [[a]] again")).toEqual(["a"]);
  });

  it("returns empty for prose without wikilinks", () => {
    expect(extractWikiTargets("No [links](here), only markdown.")).toEqual([]);
  });
});

/**
 * `extractWikiTargets` builds the "Referenced by" index from raw markdown, so
 * it has to agree with what remark-wiki-link actually renders as an anchor.
 * Where the two disagree the index grows a phantom row — a backlink to a link
 * that does not exist on the page.
 */
describe("extractWikiTargets ignores what the parser refuses to render", () => {
  it("ignores wikilinks inside fenced code blocks", async () => {
    const md = "A sample:\n\n```\n[[The QA Rule]]\n```\n";
    expect(await render(md)).not.toContain("<a ");
    expect(extractWikiTargets(md)).toEqual([]);
  });

  it("ignores wikilinks inside inline code", async () => {
    const md = "Type `[[The QA Rule]]` to link.";
    expect(await render(md)).not.toContain("<a ");
    expect(extractWikiTargets(md)).toEqual([]);
  });

  it("ignores [[target|]] with an empty alias", async () => {
    const md = "Broken: [[the-qa-rule|]].";
    expect(await render(md)).not.toContain("<a ");
    expect(extractWikiTargets(md)).toEqual([]);
  });

  it("ignores a target broken across a line ending", async () => {
    const md = "Broken: [[the\nqa rule]].";
    expect(await render(md)).not.toContain("<a ");
    expect(extractWikiTargets(md)).toEqual([]);
  });

  it("ignores whitespace-only targets", async () => {
    const md = "Broken: [[ ]].";
    expect(await render(md)).not.toContain("<a ");
    expect(extractWikiTargets(md)).toEqual([]);
  });

  it("ignores [[]] with no target at all", async () => {
    const md = "Broken: [[]].";
    expect(await render(md)).not.toContain("<a ");
    expect(extractWikiTargets(md)).toEqual([]);
  });

  it("ignores [[|alias]] with nothing before the divider", async () => {
    const md = "Broken: [[|alias]].";
    expect(await render(md)).not.toContain("<a ");
    expect(extractWikiTargets(md)).toEqual([]);
  });

  it("ignores an escaped \\[[target]]", async () => {
    const md = "Literal: \\[[the-qa-rule]].";
    expect(await render(md)).not.toContain("<a ");
    expect(extractWikiTargets(md)).toEqual([]);
  });

  it("ignores a wikilink in an indented code block", async () => {
    const md = "A sample:\n\n    [[The QA Rule]]\n";
    expect(await render(md)).not.toContain("<a ");
    expect(extractWikiTargets(md)).toEqual([]);
  });

  it("ignores a wikilink inside an HTML comment", async () => {
    const md = "<!-- [[The QA Rule]] -->";
    expect(await render(md)).not.toContain("<a ");
    expect(extractWikiTargets(md)).toEqual([]);
  });
});

describe("extractWikiTargets and the parser agree at the edges", () => {
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
});

describe("wikilinks nested inside other markdown still count", () => {
  const nested: [string, string][] = [
    ["a blockquote", "> quoted [[a]]"],
    ["a heading", "# heading [[a]]"],
    ["strong emphasis", "**[[a]]**"],
    ["inline raw HTML", "<span>[[a]]</span>"],
    ["a list item", "- item [[a]]"],
  ];

  it.each(nested)("renders and counts one inside %s", async (_label, md) => {
    expect(await render(md)).toContain('href="/notes/a/"');
    expect(extractWikiTargets(md)).toEqual(["a"]);
  });
});

describe("MDX bodies go through the same extractor as markdown", () => {
  // The notes/essays/experiments loaders all glob `*.{md,mdx}`, and
  // `entry.body` for an .mdx file is raw MDX. `extractWikiTargets` parses it
  // with a markdown-only pipeline, so JSX array-of-array props tokenize as
  // wikilinks that the rendered page never contains.
  it("does not read a JSX array-of-arrays prop as a wikilink", () => {
    expect(
      extractWikiTargets('<Chart series={[[ "The QA Rule" ]]} />'),
    ).toEqual([]);
  });

  it("does not read an exported array-of-arrays as a wikilink", () => {
    expect(extractWikiTargets("export const pairs = [[1,2]];")).toEqual([]);
  });

  it("does not give a real note a phantom row from a JSX prop", () => {
    const index = buildBacklinkIndex([
      { collection: "notes", id: "the-qa-rule", title: "Rule", body: "prose" },
      {
        collection: "experiments",
        id: "chart",
        title: "Chart",
        body: '<Chart labels={[[ "The QA Rule" ]]} />',
      },
    ]);
    expect(index.get("the-qa-rule")).toBeUndefined();
  });
});

/**
 * An `.mdx` body still has to yield the links its page really renders, and a
 * body declared `md` still has to parse by the markdown grammar — the two
 * disagree, which is why an undeclared body keeps only what both agree on.
 */
describe("a declared format parses by that grammar", () => {
  it("counts a wikilink written in mdx prose", () => {
    expect(extractWikiTargets("See [[The QA Rule]] here.", "mdx")).toEqual([
      "the-qa-rule",
    ]);
  });

  it("counts a wikilink sitting next to a JSX component", () => {
    const body = "<Chart series={[[1, 2]]} />\n\nSee [[The QA Rule]].";
    expect(extractWikiTargets(body, "mdx")).toEqual(["the-qa-rule"]);
  });

  it("still ignores a wikilink inside an mdx code fence", () => {
    expect(extractWikiTargets("```\n[[The QA Rule]]\n```", "mdx")).toEqual([]);
  });

  it("counts an internal link written in mdx", () => {
    expect(
      extractInternalLinkTargets("read [it](/essays/the-qa-rule/)", "mdx"),
    ).toEqual(["essays/the-qa-rule"]);
  });

  it("reads an indented block as code in md and as a paragraph in mdx", () => {
    // MDX disables `codeIndented`, so the same bytes render differently.
    const body = "A sample:\n\n    [[The QA Rule]]\n";
    expect(extractWikiTargets(body, "md")).toEqual([]);
    expect(extractWikiTargets(body, "mdx")).toEqual(["the-qa-rule"]);
    expect(extractWikiTargets(body)).toEqual([]);
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

  it("de-duplicates repeated internal-link targets", () => {
    const md = "[once](/essays/a/) and [twice](/essays/a/)";
    expect(extractInternalLinkTargets(md)).toEqual(["essays/a"]);
  });

  /**
   * The mirror failure of a phantom row: a link the page does render that the
   * index never counts.
   */
  it("counts a link to a heading inside a note", () => {
    expect(
      extractInternalLinkTargets("[the part](/notes/a-note/#the-part)"),
    ).toEqual(["notes/a-note"]);
  });

  it("counts a link to a heading with no trailing slash", () => {
    expect(
      extractInternalLinkTargets("[the part](/essays/an-essay#the-part)"),
    ).toEqual(["essays/an-essay"]);
  });

  it("counts a link carrying a query string", () => {
    expect(
      extractInternalLinkTargets("[the run](/experiments/the-eval/?tab=data)"),
    ).toEqual(["experiments/the-eval"]);
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

  it("gives the target a Referenced by row when the link is anchored", () => {
    const index = buildReferenceIndex([
      {
        collection: "notes",
        id: "source",
        title: "Source",
        body: "argued in [the essay](/essays/the-essay/#the-claim)",
      },
    ]);
    expect(index.get(referenceKey("essays", "the-essay"))).toEqual([
      { collection: "notes", id: "source", title: "Source" },
    ]);
  });
});

describe("self-reference exemption compares like with like", () => {
  // `buildBacklinkIndex` slugifies the target but not `entry.id`, so an id
  // that is not already slug-shaped escapes the self-link exemption. Astro's
  // glob loader hands back `data.slug` verbatim when frontmatter declares it.
  const unslugged: LinkedEntry = {
    collection: "notes",
    id: "The-QA-Rule",
    title: "The QA Rule",
    body: "see [[The QA Rule]]",
  };

  it("slugifies the id it compares against, so the case is a real self-link", () => {
    expect(slugifyWikiTarget(unslugged.id)).toEqual(
      extractWikiTargets(unslugged.body)[0],
    );
  });

  it("exempts a note from itself when its id is not slug-shaped", () => {
    expect(buildBacklinkIndex([unslugged]).get("the-qa-rule")).toBeUndefined();
  });

  it("exempts an entry from itself in the reference index too", () => {
    expect(
      buildReferenceIndex([unslugged]).get(
        referenceKey("notes", "the-qa-rule"),
      ),
    ).toBeUndefined();
  });
});

describe("rendered output through the real remark pipeline", () => {
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

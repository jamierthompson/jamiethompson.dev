import { describe, expect, it } from "vitest";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import { wikiLinkPlugin } from "remark-wiki-link";
import {
  buildReferenceIndex,
  entryFormatFromPath,
  extractInternalLinkTargets,
  extractWikiTargets,
  findSlugCollisions,
  referenceKey,
  resolveWikiTarget,
  slugifyWikiTarget,
  wikiLinkOptions,
  type LinkedEntry,
} from "./wikilinks";

const render = async (
  md: string,
  permalinks: string[] = [],
): Promise<string> => {
  const file = await unified()
    .use(remarkParse)
    .use(wikiLinkPlugin, { ...wikiLinkOptions, permalinks })
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
    expect(html.match(/href="\/writing\/c\/"/g)).toHaveLength(2);
    expect(extractWikiTargets(md)).toEqual(["c"]);
  });

  it("keeps non-ASCII letters in the slug", async () => {
    expect(extractWikiTargets("[[Café]]")).toEqual(["café"]);
    expect(await render("[[Café]]")).toContain('href="/writing/café/"');
  });

  it("swallows a # fragment into the target rather than splitting on it", async () => {
    const md = "[[target#a-heading]]";
    expect(extractWikiTargets(md)).toEqual(["targeta-heading"]);
    expect(await render(md)).toContain('href="/writing/targeta-heading/"');
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
    expect(entryFormatFromPath("src/content/writing/a-note.md")).toBe("md");
    expect(entryFormatFromPath("src/content/writing/a-note.mdx")).toBe("mdx");
  });

  it("has no opinion when the loader stored no path", () => {
    expect(entryFormatFromPath(undefined)).toBeUndefined();
  });

  it("treats .MDX as markdown, the way Astro's exact extension map does", () => {
    expect(entryFormatFromPath("src/content/writing/a-note.MDX")).toBe("md");
  });

  it("does not read .mdx in a directory name as the extension", () => {
    expect(entryFormatFromPath("src/content/writing/about.mdx/index.md")).toBe(
      "md",
    );
  });

  it("falls back to markdown for a path with no extension", () => {
    expect(entryFormatFromPath("src/content/writing/README")).toBe("md");
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
    expect(html).toContain('href="/writing/a/"');
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
      'href="/writing/the-qa-rule/"',
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
    expect(await render(md)).toContain('href="/writing/a/"');
    expect(extractWikiTargets(md)).toEqual(["a"]);
  });
});

describe("MDX bodies go through the same extractor as markdown", () => {
  // The collection loaders glob `*.{md,mdx}`, and `entry.body` for an .mdx
  // file is raw MDX. `extractWikiTargets` parses it with a markdown-only
  // pipeline, so JSX array-of-array props tokenize as wikilinks that the
  // rendered page never contains.
  it("does not read a JSX array-of-arrays prop as a wikilink", () => {
    expect(
      extractWikiTargets('<Chart series={[[ "The QA Rule" ]]} />'),
    ).toEqual([]);
  });

  it("does not read an exported array-of-arrays as a wikilink", () => {
    expect(extractWikiTargets("export const pairs = [[1,2]];")).toEqual([]);
  });

  it("does not give a real note a phantom row from a JSX prop", () => {
    const index = buildReferenceIndex([
      {
        collection: "writing",
        id: "the-qa-rule",
        title: "Rule",
        body: "prose",
      },
      {
        collection: "projects",
        id: "chart",
        title: "Chart",
        body: '<Chart labels={[[ "The QA Rule" ]]} />',
      },
    ]);
    expect(index.get(referenceKey("writing", "the-qa-rule"))).toBeUndefined();
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
      extractInternalLinkTargets("read [it](/projects/the-qa-rule/)", "mdx"),
    ).toEqual(["projects/the-qa-rule"]);
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
      "Read [the essay](/projects/the-qa-rule/) and " +
      "[a note](/writing/no-prior-context).";
    expect(extractInternalLinkTargets(md)).toEqual([
      "projects/the-qa-rule",
      "writing/no-prior-context",
    ]);
  });

  it("ignores external URLs, a collection index, and the home page", () => {
    const md =
      "See [GitHub](https://github.com/jamierthompson/digital-garden), " +
      "[all writing](/writing/), and [home](/).";
    expect(extractInternalLinkTargets(md)).toEqual([]);
  });

  it("ignores an entry-shaped path under a name that is not a collection", () => {
    // Every path above is refused on shape, before the collection alternation
    // is consulted at all. This one has the two segments of a real entry, so
    // the alternation is the only thing left that can reject it.
    expect(
      extractInternalLinkTargets("[a recipe](/recipes/a-recipe/)"),
    ).toEqual([]);
  });

  it("ignores links inside code fences and inline code", () => {
    const md =
      "```md\n[fenced](/projects/fenced/)\n```\n" +
      "and `[inline](/writing/inline/)` stay text.";
    expect(extractInternalLinkTargets(md)).toEqual([]);
  });

  it("de-duplicates repeated internal-link targets", () => {
    const md = "[once](/projects/a/) and [twice](/projects/a/)";
    expect(extractInternalLinkTargets(md)).toEqual(["projects/a"]);
  });

  /**
   * The mirror failure of a phantom row: a link the page does render that the
   * index never counts.
   */
  it("counts a link to a heading inside a note", () => {
    expect(
      extractInternalLinkTargets("[the part](/writing/a-note/#the-part)"),
    ).toEqual(["writing/a-note"]);
  });

  it("counts a link to a heading with no trailing slash", () => {
    expect(
      extractInternalLinkTargets("[the part](/projects/an-essay#the-part)"),
    ).toEqual(["projects/an-essay"]);
  });

  it("counts a link carrying a query string", () => {
    expect(
      extractInternalLinkTargets("[the run](/projects/the-eval/?tab=data)"),
    ).toEqual(["projects/the-eval"]);
  });
});

describe("buildReferenceIndex", () => {
  const entry = (
    collection: LinkedEntry["collection"],
    id: string,
    body: string,
  ): LinkedEntry => ({ collection, id, title: `title:${id}`, body });

  it("refuses a wikilink no entry resolves, naming the source and target", () => {
    expect(() =>
      buildReferenceIndex([
        entry("projects", "an-essay", "cites [[a-note]] and [[Another]]"),
        entry("writing", "b-note", "cites [[a-note]]"),
      ]),
    ).toThrow(
      "A wikilink must name a published entry: projects/an-essay links to [[a-note]]; projects/an-essay links to [[another]]; writing/b-note links to [[a-note]].",
    );
  });

  it("does not refuse a wikilink inside code, which never renders as a link", () => {
    expect(() =>
      buildReferenceIndex([entry("writing", "a", "`[[nowhere]]`")]),
    ).not.toThrow();
  });

  it("indexes a wikilink under whichever collection holds the target", () => {
    const index = buildReferenceIndex([
      entry(
        "writing",
        "a-note",
        "built in [[the-project]], argued in [[the-essay]]",
      ),
      entry("projects", "the-project", "prose"),
      entry("projects", "the-essay", "prose"),
    ]);
    expect(index.get(referenceKey("projects", "the-project"))).toEqual([
      { collection: "writing", id: "a-note", title: "title:a-note" },
    ]);
    expect(index.get(referenceKey("projects", "the-essay"))).toEqual([
      { collection: "writing", id: "a-note", title: "title:a-note" },
    ]);
    expect(index.get(referenceKey("writing", "the-project"))).toBeUndefined();
  });

  it("indexes internal-link references to projects", () => {
    const index = buildReferenceIndex([
      entry(
        "projects",
        "an-essay",
        "shipped as [the project](/projects/the-project/)",
      ),
    ]);
    expect(index.get(referenceKey("projects", "the-project"))).toEqual([
      { collection: "projects", id: "an-essay", title: "title:an-essay" },
    ]);
  });

  it("indexes internal-link references to writing and projects alike", () => {
    const index = buildReferenceIndex([
      entry("writing", "a-note", "stated in [the note](/writing/the-note/)"),
      entry("writing", "b-note", "argued in [the essay](/projects/the-essay/)"),
    ]);
    expect(index.get(referenceKey("writing", "the-note"))).toEqual([
      { collection: "writing", id: "a-note", title: "title:a-note" },
    ]);
    expect(index.get(referenceKey("projects", "the-essay"))).toEqual([
      { collection: "writing", id: "b-note", title: "title:b-note" },
    ]);
  });

  it("drops self-references and collapses repeat links from one source", () => {
    const index = buildReferenceIndex([
      entry(
        "writing",
        "self",
        "[[self]] and [me](/writing/self/), plus [[other]] and [other again](/writing/other/)",
      ),
      entry("writing", "other", "prose"),
    ]);
    expect(index.get(referenceKey("writing", "self"))).toBeUndefined();
    expect(index.get(referenceKey("writing", "other"))).toEqual([
      { collection: "writing", id: "self", title: "title:self" },
    ]);
  });

  it("does not conflate same ids across collections", () => {
    const index = buildReferenceIndex([
      entry("writing", "a", "[link](/projects/shared/)"),
      entry("writing", "b", "[link](/writing/shared/)"),
    ]);
    expect(index.get(referenceKey("projects", "shared"))).toHaveLength(1);
    expect(index.get(referenceKey("writing", "shared"))).toHaveLength(1);
  });

  it("gives the target a Referenced by row when the link is anchored", () => {
    const index = buildReferenceIndex([
      {
        collection: "writing",
        id: "source",
        title: "Source",
        body: "argued in [the essay](/projects/the-essay/#the-claim)",
      },
    ]);
    expect(index.get(referenceKey("projects", "the-essay"))).toEqual([
      { collection: "writing", id: "source", title: "Source" },
    ]);
  });
});

describe("self-reference exemption compares like with like", () => {
  // A wikilink target is always slugified but `entry.id` need not be: Astro's
  // glob loader hands back `data.slug` verbatim when frontmatter declares it,
  // so comparing the two raw would let an entry escape the self-link
  // exemption.
  const unslugged: LinkedEntry = {
    collection: "writing",
    id: "The-QA-Rule",
    title: "The QA Rule",
    body: "see [[The QA Rule]]",
  };

  it("slugifies the id it compares against, so the case is a real self-link", () => {
    expect(slugifyWikiTarget(unslugged.id)).toEqual(
      extractWikiTargets(unslugged.body)[0],
    );
  });

  it("exempts an entry from itself in the reference index too", () => {
    expect(
      buildReferenceIndex([unslugged]).get(
        referenceKey("writing", "the-qa-rule"),
      ),
    ).toBeUndefined();
  });
});

describe("resolveWikiTarget", () => {
  it("lands on the collection that holds the target", () => {
    const keys = new Set(["projects/oklch", "projects/on-color"]);
    expect(resolveWikiTarget("oklch", keys)).toBe("projects/oklch");
    expect(resolveWikiTarget("on-color", keys)).toBe("projects/on-color");
  });

  it("has no answer for a target no collection holds", () => {
    expect(resolveWikiTarget("unwritten", new Set())).toBeUndefined();
  });
});

describe("findSlugCollisions", () => {
  it("names a slug claimed by more than one collection", () => {
    expect(
      findSlugCollisions(["writing/oklch", "projects/oklch", "projects/other"]),
    ).toEqual(["oklch (writing, projects)"]);
  });

  it("finds nothing when every slug is unique", () => {
    expect(
      findSlugCollisions(["writing/a", "projects/b", "projects/c"]),
    ).toEqual([]);
  });
});

describe("rendered output through the real remark pipeline", () => {
  it("renders [[target]] into the collection that holds it", async () => {
    const html = await render("See [[oklch]].", ["projects/oklch"]);
    expect(html).toContain('href="/projects/oklch/"');
    expect(html).toContain('class="internal"');
  });

  it("renders the alias as the link text", async () => {
    const html = await render("See [[the-qa-rule|the rule]].", [
      "writing/the-qa-rule",
    ]);
    expect(html).toContain('href="/writing/the-qa-rule/"');
    expect(html).toContain(">the rule</a>");
  });
});

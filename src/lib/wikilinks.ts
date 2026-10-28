import { slug } from "github-slugger";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkMdx from "remark-mdx";
import { visit } from "unist-util-visit";
import { wikiLinkPlugin } from "remark-wiki-link";
import type { Node } from "unist";

/**
 * Wikilink conventions shared by the remark pipeline (astro.config.ts) and
 * the backlink index — one definition so they can't drift.
 *
 * `[[target]]` and `[[target|alias]]` resolve to whichever linked collection
 * has an entry with that slug, which is why slugs must be unique across
 * collections (see `findSlugCollisions`). Targets slugify with
 * github-slugger — the same slugger Astro's glob loader uses for entry ids —
 * so a wikilink can always reach the entry it names. A link to an entry that
 * doesn't exist fails the build: `buildReferenceIndex` refuses it, and every
 * entry page builds that index.
 */

export const LINKED_COLLECTIONS = ["writing"] as const;

export type LinkedCollection = (typeof LINKED_COLLECTIONS)[number];

export function slugifyWikiTarget(name: string): string {
  return slug(name.trim().replace(/\s+/g, " "));
}

export const wikiLinkOptions = {
  aliasDivider: "|",
  /** Candidate reference keys, one per collection, in resolution order. */
  pageResolver: (name: string): string[] =>
    LINKED_COLLECTIONS.map((collection) =>
      referenceKey(collection, slugifyWikiTarget(name)),
    ),
  hrefTemplate: (permalink: string): string => `/${permalink}/`,
};

/**
 * The reference key a wikilink target lands on, by the same rule
 * remark-wiki-link applies when it renders the link: the first candidate
 * that exists, else `undefined`.
 */
export function resolveWikiTarget(
  target: string,
  existingKeys: ReadonlySet<string>,
): string | undefined {
  return wikiLinkOptions
    .pageResolver(target)
    .find((key) => existingKeys.has(key));
}

/**
 * Slugs claimed by more than one collection. `[[slug]]` can only name one
 * entry, so any collision would make a wikilink silently pick a side.
 */
export function findSlugCollisions(keys: Iterable<string>): string[] {
  const collections = new Map<string, string[]>();
  for (const key of keys) {
    const [collection, id] = key.split("/");
    collections.set(id, [...(collections.get(id) ?? []), collection]);
  }
  return [...collections]
    .filter(([, owners]) => owners.length > 1)
    .map(([id, owners]) => `${id} (${owners.join(", ")})`);
}

interface WikiLinkNode extends Node {
  value: string;
}

export type EntryFormat = "md" | "mdx";

const MDX_EXTENSION = ".mdx";

/**
 * The format Astro renders an entry with, from the `filePath` its loader
 * stored. Astro resolves this the same way: the glob loader looks the
 * extension up in an exact, case-sensitive map of registered entry types
 * (`astro/dist/content/loaders/glob.js`), and `@astrojs/mdx` registers only
 * `.mdx` — so `.MDX` matches nothing and such a file never becomes an entry
 * at all.
 *
 * Anything that is not exactly `.mdx` is therefore markdown, which is also
 * the safe direction: MDX is not a superset of markdown — it disables
 * `codeIndented`, `autolink`, `htmlFlow` and `htmlText`, and throws outright
 * on ordinary prose like an HTML comment or `x<3`. A path with no extension,
 * or one whose *directory* merely ends in `.mdx`, lands on markdown rather
 * than throwing.
 */
export function entryFormatFromPath(
  filePath: string | undefined,
): EntryFormat | undefined {
  if (filePath === undefined) return undefined;
  return filePath.endsWith(MDX_EXTENSION) ? "mdx" : "md";
}

const markdownParser = unified()
  .use(remarkParse)
  .use(wikiLinkPlugin, wikiLinkOptions);

const mdxParser = unified()
  .use(remarkParse)
  .use(remarkMdx)
  .use(wikiLinkPlugin, wikiLinkOptions);

/**
 * The two grammars disagree in both directions, so neither is a safe stand-in
 * for the other: markdown reads a JSX array-of-arrays prop as a wikilink,
 * while MDX turns an indented code block into a paragraph — it disables
 * `codeIndented`, `autolink`, `htmlFlow` and `htmlText`. A body with no
 * declared format therefore keeps only the targets both grammars agree the
 * page renders, which is the direction that cannot invent a phantom backlink.
 */
function collectTargets(
  body: string,
  format: EntryFormat | undefined,
  collect: (tree: Node) => string[],
): string[] {
  if (format === "md") return collect(markdownParser.parse(body));
  if (format === "mdx") return collect(mdxParser.parse(body));

  const asMarkdown = collect(markdownParser.parse(body));
  let asMdx: string[];
  try {
    asMdx = collect(mdxParser.parse(body));
  } catch {
    // Not valid MDX, so markdown is the only grammar that could render it.
    return asMarkdown;
  }
  const renderedByMdx = new Set(asMdx);
  return asMarkdown.filter((target) => renderedByMdx.has(target));
}

/**
 * Extraction runs the real parser, not a regex, so the backlink index counts
 * exactly the links the rendered page carries — a wikilink inside a code
 * fence, inline code, or (in MDX) a JSX prop renders as something other than
 * a link and must not create a backlink.
 */
export function extractWikiTargets(
  body: string,
  format?: EntryFormat,
): string[] {
  return collectTargets(body, format, (tree) => {
    const targets = new Set<string>();
    visit(tree, "wikiLink", (node: WikiLinkNode) => {
      targets.add(slugifyWikiTarget(node.value));
    });
    return [...targets];
  });
}

export interface LinkedEntry {
  collection: LinkedCollection;
  id: string;
  title: string;
  body: string;
  /** Omitted when the loader gave the entry no file path to read it from. */
  format?: EntryFormat;
}

export interface Backlink {
  collection: LinkedCollection;
  id: string;
  title: string;
}

export function referenceKey(collection: LinkedCollection, id: string): string {
  return `${collection}/${id}`;
}

/**
 * A trailing fragment or query narrows where a link lands *within* an entry,
 * so it is part of the URL but not part of the id — it is matched and
 * discarded rather than allowed to fail the whole match.
 */
const INTERNAL_LINK_PATTERN = new RegExp(
  `^/(${LINKED_COLLECTIONS.join("|")})/([^/#?]+)/?(?:[#?].*)?$`,
);

interface MarkdownLinkNode extends Node {
  url: string;
}

/**
 * Internal `[text](/collection/id/)` targets, as reference keys.
 *
 * A fragment or query is stripped, so `/writing/a-note/#the-part` references
 * `writing/a-note` — the page renders one cross-reference either way. What
 * never matches is a link that names no single entry: an index page
 * (`/writing/`), a path outside the linked collections, a deeper path
 * (`/writing/a/b/`), and any external URL.
 */
export function extractInternalLinkTargets(
  body: string,
  format?: EntryFormat,
): string[] {
  return collectTargets(body, format, (tree) => {
    const targets = new Set<string>();
    visit(tree, "link", (node: MarkdownLinkNode) => {
      const match = INTERNAL_LINK_PATTERN.exec(node.url);
      if (match) {
        targets.add(referenceKey(match[1] as LinkedCollection, match[2]));
      }
    });
    return [...targets];
  });
}

/**
 * Map from an entry's reference key to every entry whose body references it,
 * by wikilink (resolved across collections) or by internal markdown link.
 * Self-references are dropped; a source appears once per target no matter
 * how many times it links.
 *
 * A wikilink that no entry resolves throws, naming the source and target.
 * This is the build's only gate for it: remark-wiki-link still renders such a
 * link (pointing at a page that is never emitted), and a remark plugin cannot
 * refuse it either, because Astro's glob loader catches a render error, logs
 * it and stores the entry with an empty body (`content/loaders/glob.js`).
 * Every entry page builds this index, so throwing here fails the build.
 * The index is built from published entries, so a link to a draft is refused
 * too — it would be a 404 all the same.
 *
 * Both sides of the self-link comparison are slugified: a wikilink target
 * always is, but an entry id is only slug-shaped by convention — Astro's
 * glob loader hands back a frontmatter `slug` verbatim — and comparing the
 * two raw would let an entry list itself as a backlink to itself.
 */
export function buildReferenceIndex(
  entries: LinkedEntry[],
): Map<string, Backlink[]> {
  const existingKeys = new Set(
    entries.map((entry) =>
      referenceKey(entry.collection, slugifyWikiTarget(entry.id)),
    ),
  );
  const index = new Map<string, Backlink[]>();
  const unresolved: string[] = [];
  for (const entry of entries) {
    const selfKey = referenceKey(entry.collection, slugifyWikiTarget(entry.id));
    const targets = new Set([
      ...extractWikiTargets(entry.body, entry.format).flatMap((target) => {
        const key = resolveWikiTarget(target, existingKeys);
        if (key === undefined) {
          unresolved.push(`${selfKey} links to [[${target}]]`);
          return [];
        }
        return [key];
      }),
      ...extractInternalLinkTargets(entry.body, entry.format),
    ]);
    for (const target of targets) {
      if (target === selfKey) continue;
      const sources = index.get(target) ?? [];
      sources.push({
        collection: entry.collection,
        id: entry.id,
        title: entry.title,
      });
      index.set(target, sources);
    }
  }
  if (unresolved.length > 0) {
    throw new Error(
      `A wikilink must name a published entry: ${unresolved.join("; ")}.`,
    );
  }
  return index;
}

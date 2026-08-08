import { slug } from "github-slugger";
import { unified, type Processor } from "unified";
import remarkParse from "remark-parse";
import { visit } from "unist-util-visit";
import { wikiLinkPlugin } from "remark-wiki-link";
import type { Node } from "unist";

/**
 * Wikilink conventions shared by the remark pipeline (astro.config.ts), the
 * backlink index, and the tests — one definition so they can't drift.
 *
 * `[[target]]` and `[[target|alias]]` resolve into the notes namespace.
 * Targets slugify with github-slugger — the same slugger Astro's glob loader
 * uses for entry ids — so a wikilink can always reach the note it names.
 * A link to a note that doesn't exist yet is allowed by design: it renders
 * with the `new` class (wired via `permalinks` in astro.config.ts) and marks
 * something worth writing later.
 */

export function slugifyWikiTarget(name: string): string {
  return slug(name.trim().replace(/\s+/g, " "));
}

export const wikiLinkOptions = {
  aliasDivider: "|",
  pageResolver: (name: string): string[] => [slugifyWikiTarget(name)],
  hrefTemplate: (permalink: string): string => `/notes/${permalink}/`,
};

interface WikiLinkNode extends Node {
  value: string;
}

const parser: Processor = unified()
  .use(remarkParse)
  .use(wikiLinkPlugin, wikiLinkOptions);

/**
 * Extraction runs the real parser, not a regex, so the backlink index counts
 * exactly the links the rendered page carries — a wikilink inside a code
 * fence or inline code renders as text and must not create a backlink.
 */
export function extractWikiTargets(markdown: string): string[] {
  const tree = parser.parse(markdown);
  const targets = new Set<string>();
  visit(tree, "wikiLink", (node: WikiLinkNode) => {
    targets.add(slugifyWikiTarget(node.value));
  });
  return [...targets];
}

export type LinkedCollection = "essays" | "notes" | "experiments";

export interface LinkedEntry {
  collection: LinkedCollection;
  id: string;
  title: string;
  body: string;
}

export interface Backlink {
  collection: LinkedCollection;
  id: string;
  title: string;
}

/** Map from a note's id to every entry whose body wikilinks to it. */
export function buildBacklinkIndex(
  entries: LinkedEntry[],
): Map<string, Backlink[]> {
  const index = new Map<string, Backlink[]>();
  for (const entry of entries) {
    for (const target of extractWikiTargets(entry.body)) {
      if (entry.collection === "notes" && target === entry.id) continue;
      const sources = index.get(target) ?? [];
      sources.push({
        collection: entry.collection,
        id: entry.id,
        title: entry.title,
      });
      index.set(target, sources);
    }
  }
  return index;
}

/** Key an entry is indexed under in the reference index. */
export function referenceKey(collection: LinkedCollection, id: string): string {
  return `${collection}/${id}`;
}

const INTERNAL_LINK_PATTERN = /^\/(essays|notes|experiments)\/([^/#?]+)\/?$/;

interface MarkdownLinkNode extends Node {
  url: string;
}

/**
 * Internal `[text](/collection/id/)` targets, as reference keys. Like
 * wikilink extraction this runs the real parser, so a link inside a code
 * fence or inline code renders as text and must not create a reference.
 * Index pages (`/notes/`) and external URLs never match.
 */
export function extractInternalLinkTargets(markdown: string): string[] {
  const tree = parser.parse(markdown);
  const targets = new Set<string>();
  visit(tree, "link", (node: MarkdownLinkNode) => {
    const match = INTERNAL_LINK_PATTERN.exec(node.url);
    if (match) {
      targets.add(referenceKey(match[1] as LinkedCollection, match[2]));
    }
  });
  return [...targets];
}

/**
 * Map from an entry's reference key to every entry whose body references it,
 * by wikilink (always a note target) or by internal markdown link (any
 * collection). Self-references are dropped; a source appears once per target
 * no matter how many times it links.
 */
export function buildReferenceIndex(
  entries: LinkedEntry[],
): Map<string, Backlink[]> {
  const index = new Map<string, Backlink[]>();
  for (const entry of entries) {
    const selfKey = referenceKey(entry.collection, entry.id);
    const targets = new Set([
      ...extractWikiTargets(entry.body).map((id) => referenceKey("notes", id)),
      ...extractInternalLinkTargets(entry.body),
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
  return index;
}

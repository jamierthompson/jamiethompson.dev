/**
 * Wikilink conventions shared by the remark pipeline (astro.config.ts), the
 * backlink index, and the tests — one definition so they can't drift.
 *
 * `[[target]]` and `[[target|alias]]` resolve into the notes namespace.
 * A link to a note that doesn't exist yet is allowed by design: it renders
 * with the `new` class and marks something worth writing later.
 */

export function slugifyWikiTarget(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, "-");
}

export const wikiLinkOptions = {
  aliasDivider: "|",
  pageResolver: (name: string): string[] => [slugifyWikiTarget(name)],
  hrefTemplate: (permalink: string): string => `/notes/${permalink}/`,
};

const WIKI_LINK_PATTERN = /\[\[([^\][|]+)(?:\|[^\][]*)?\]\]/g;

export function extractWikiTargets(markdown: string): string[] {
  const targets = new Set<string>();
  for (const match of markdown.matchAll(WIKI_LINK_PATTERN)) {
    targets.add(slugifyWikiTarget(match[1]));
  }
  return [...targets];
}

export interface LinkedEntry {
  collection: "essays" | "notes";
  id: string;
  title: string;
  body: string;
}

export interface Backlink {
  collection: "essays" | "notes";
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

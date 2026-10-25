import type { MarkdownHeading } from "astro";

export interface TocEntry {
  slug: string;
  text: string;
  children: TocEntry[];
}

/**
 * Headings that are page furniture, not sections. GFM's footnotes add a
 * visually hidden "Footnotes" h2 to label the list for screen readers; it
 * has nothing to show in a visible contents list.
 */
const EXCLUDED_SLUGS = new Set(["footnote-label"]);

/**
 * The table of contents for a page: its h2s, with h3s nested under the h2
 * that precedes them. The h1 is the page title. An h3 with no h2 before it
 * stands at the top level rather than disappearing.
 */
export function buildToc(headings: readonly MarkdownHeading[]): TocEntry[] {
  const toc: TocEntry[] = [];
  for (const { depth, slug, text } of headings) {
    if (EXCLUDED_SLUGS.has(slug)) continue;
    if (depth === 2) {
      toc.push({ slug, text, children: [] });
    } else if (depth === 3) {
      const parent = toc.at(-1);
      (parent ? parent.children : toc).push({ slug, text, children: [] });
    }
  }
  return toc;
}

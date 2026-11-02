import { getCollection, type CollectionEntry } from "astro:content";

/** The collections that have pages, all sortable by `pubDate`. */
export type PagedCollection = "writing";

type Dated = { data: { pubDate: Date } };

/** Newest first. Ties keep the loader's order. */
export const byNewest = (a: Dated, b: Dated): number =>
  b.data.pubDate.valueOf() - a.data.pubDate.valueOf();

/**
 * Whether an entry gets a page and a place in listings.
 *
 * Drafts are visible in the dev server, so they can be previewed in place,
 * and absent from a production build. Every query over a collection goes
 * through this so the two never disagree.
 */
export const isVisible = ({ data }: { data: { draft: boolean } }): boolean =>
  import.meta.env.DEV || !data.draft;

/** Every visible entry, newest first. */
export async function published<C extends PagedCollection>(
  collection: C,
): Promise<CollectionEntry<C>[]> {
  const entries = await getCollection(collection, isVisible);
  return entries.sort(byNewest);
}

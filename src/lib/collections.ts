import { getCollection, type CollectionEntry } from "astro:content";

/** The two collections that have pages, both sortable by `pubDate`. */
export type PagedCollection = "writing" | "projects";

type Dated = { data: { pubDate: Date } };

/** Newest first. Ties keep the loader's order. */
export const byNewest = (a: Dated, b: Dated): number =>
  b.data.pubDate.valueOf() - a.data.pubDate.valueOf();

/** Every entry that is not a draft, newest first. */
export async function published<C extends PagedCollection>(
  collection: C,
): Promise<CollectionEntry<C>[]> {
  const entries = await getCollection(collection, ({ data }) => !data.draft);
  return entries.sort(byNewest);
}

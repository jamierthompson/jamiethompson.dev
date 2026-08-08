import { getCollection } from "astro:content";
import {
  buildReferenceIndex,
  referenceKey,
  type Backlink,
  type LinkedCollection,
  type LinkedEntry,
} from "./wikilinks";

/**
 * The index spans every published entry and is identical for every page, so
 * it is built once per build and shared across getBacklinks callers.
 */
let indexPromise: Promise<Map<string, Backlink[]>> | undefined;

async function buildIndex(): Promise<Map<string, Backlink[]>> {
  const published = [
    ...(await getCollection("essays", ({ data }) => !data.draft)),
    ...(await getCollection("notes", ({ data }) => !data.draft)),
    ...(await getCollection("experiments", ({ data }) => !data.draft)),
  ];
  const entries: LinkedEntry[] = published.map((entry) => ({
    collection: entry.collection,
    id: entry.id,
    title: entry.data.title,
    body: entry.body ?? "",
  }));
  return buildReferenceIndex(entries);
}

export async function getBacklinks(
  collection: LinkedCollection,
  id: string,
): Promise<Backlink[]> {
  indexPromise ??= buildIndex();
  return (await indexPromise).get(referenceKey(collection, id)) ?? [];
}

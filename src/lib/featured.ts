import { getEntries, getEntry, type CollectionEntry } from "astro:content";

/**
 * The entries `featured.yaml` names, in its order.
 *
 * `reference()` in the schema types the slugs, but a slug that resolves to
 * nothing comes back from `getEntries` as a hole rather than an error, and a
 * draft resolves fine — it just has no page. Either would ship a home page
 * with a dead card on it, so both fail the build here instead.
 */
export async function getFeatured(): Promise<{
  projects: CollectionEntry<"projects">[];
  writing: CollectionEntry<"writing">[];
}> {
  const home = await getEntry("featured", "home");
  if (!home) {
    throw new Error(
      "featured.yaml needs a `home` key with `projects` and `writing` lists.",
    );
  }
  return {
    projects: checkFeatured(
      "projects",
      home.data.projects.map(({ id }) => id),
      await getEntries(home.data.projects),
    ),
    writing: checkFeatured(
      "writing",
      home.data.writing.map(({ id }) => id),
      await getEntries(home.data.writing),
    ),
  };
}

/**
 * `ids` are the slugs as written and `entries` what they resolved to, in the
 * same order. Pure, so the three failure modes are unit-testable without a
 * content store.
 */
export function checkFeatured<
  T extends { id: string; data: { draft: boolean } },
>(
  collection: string,
  ids: readonly string[],
  entries: readonly (T | undefined)[],
): T[] {
  const seen = new Set<string>();
  return entries.map((entry, index) => {
    const id = ids[index];
    if (!entry) {
      throw new Error(
        `featured.yaml lists "${id}" under ${collection}, but no ${collection} entry has that slug.`,
      );
    }
    if (entry.data.draft) {
      throw new Error(
        `featured.yaml lists "${id}" under ${collection}, but it is a draft and has no page.`,
      );
    }
    if (seen.has(entry.id)) {
      throw new Error(`featured.yaml lists "${id}" under ${collection} twice.`);
    }
    seen.add(entry.id);
    return entry;
  });
}

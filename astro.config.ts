import { existsSync, readdirSync } from "node:fs";
import { defineConfig } from "astro/config";
import { unified } from "@astrojs/markdown-remark";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import { wikiLinkPlugin } from "remark-wiki-link";
import { rehypeMarkExternalLinks } from "./src/lib/externalLink";
import { CONTENT_DIR } from "./src/lib/contentDir";
import { SITE_URL } from "./src/lib/site";
import {
  findSlugCollisions,
  LINKED_COLLECTIONS,
  referenceKey,
  slugifyWikiTarget,
  wikiLinkOptions,
} from "./src/lib/wikilinks";

// Reference keys of entries that exist right now, so remark-wiki-link can
// resolve `[[slug]]` to the collection that holds it and class links to
// unwritten entries as `new` instead of classing every link that way.
const existingEntryKeys = LINKED_COLLECTIONS.flatMap((collection) => {
  const dir = `${CONTENT_DIR}/${collection}`;
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((file) => /\.(md|mdx)$/.test(file))
    .map((file) =>
      referenceKey(
        collection,
        slugifyWikiTarget(file.replace(/\.(md|mdx)$/, "")),
      ),
    );
});

const collisions = findSlugCollisions(existingEntryKeys);
if (collisions.length > 0) {
  throw new Error(
    `Slugs must be unique across collections so [[slug]] names one entry. Rename: ${collisions.join("; ")}`,
  );
}

export default defineConfig({
  site: SITE_URL,
  integrations: [mdx(), sitemap()],
  markdown: {
    // MDX inherits these plugin lists, so one rule serves .md and .mdx. It
    // does not inherit the plugin order — see src/lib/externalLink.test.ts
    // for what that costs.
    processor: unified({
      remarkPlugins: [
        [wikiLinkPlugin, { ...wikiLinkOptions, permalinks: existingEntryKeys }],
      ],
      rehypePlugins: [rehypeMarkExternalLinks],
    }),
  },
});

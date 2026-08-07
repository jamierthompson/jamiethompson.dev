import { readdirSync } from "node:fs";
import { defineConfig } from "astro/config";
import { unified } from "@astrojs/markdown-remark";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import { wikiLinkPlugin } from "remark-wiki-link";
import { slugifyWikiTarget, wikiLinkOptions } from "./src/lib/wikilinks";

// Slugs of notes that exist right now, so remark-wiki-link can class links
// to unwritten notes as `new` instead of classing every link that way.
const existingNoteSlugs = readdirSync("./src/content/notes")
  .filter((file) => /\.(md|mdx)$/.test(file))
  .map((file) => slugifyWikiTarget(file.replace(/\.(md|mdx)$/, "")));

export default defineConfig({
  site: "https://jamiethompson.dev",
  integrations: [mdx(), sitemap()],
  markdown: {
    // MDX inherits this processor, so .md and .mdx share one pipeline.
    processor: unified({
      remarkPlugins: [
        [wikiLinkPlugin, { ...wikiLinkOptions, permalinks: existingNoteSlugs }],
      ],
    }),
  },
});

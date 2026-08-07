import { defineConfig } from "astro/config";
import { unified } from "@astrojs/markdown-remark";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import { wikiLinkPlugin } from "remark-wiki-link";
import { wikiLinkOptions } from "./src/lib/wikilinks";

export default defineConfig({
  site: "https://jamiethompson.dev",
  integrations: [mdx(), sitemap()],
  markdown: {
    // MDX inherits this processor, so .md and .mdx share one pipeline.
    processor: unified({
      remarkPlugins: [[wikiLinkPlugin, wikiLinkOptions]],
    }),
  },
});

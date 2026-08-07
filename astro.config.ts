import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import { wikiLinkPlugin } from "remark-wiki-link";
import { wikiLinkOptions } from "./src/lib/wikilinks";

export default defineConfig({
  site: "https://jamiethompson.dev",
  integrations: [mdx(), sitemap()],
  markdown: {
    remarkPlugins: [[wikiLinkPlugin, wikiLinkOptions]],
  },
});

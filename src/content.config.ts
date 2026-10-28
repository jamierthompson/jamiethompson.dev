import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";
import { CONTENT_DIR } from "./lib/contentDir";

/**
 * Every post, long or short.
 *
 * `cover` is optional: an entry page renders with or without one. The `alt`
 * is required with it, because a picture that leads a page is content, not
 * decoration.
 *
 * `category` labels an entry in a list and is what the index page filters
 * by. Required, so every entry can be found under some tab.
 */
const writing = defineCollection({
  loader: glob({ pattern: "*.{md,mdx}", base: `${CONTENT_DIR}/writing` }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      description: z.string(),
      pubDate: z.coerce.date(),
      updated: z.coerce.date().optional(),
      draft: z.boolean().default(false),
      category: z.string(),
      cover: z.object({ src: image(), alt: z.string() }).optional(),
    }),
});

export const collections = { writing };

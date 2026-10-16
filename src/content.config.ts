import { defineCollection, type SchemaContext } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";
import { CONTENT_DIR } from "./lib/contentDir";

/**
 * `cover` is optional on both collections: a card or an entry page renders
 * with or without one. The `alt` is required with it, because a picture that
 * leads a card or a page is content, not decoration.
 *
 * `category` labels an entry in a list and is what the index pages filter
 * by. Required, so every entry can be found under some tab.
 */
const entrySchema = ({ image }: SchemaContext) =>
  z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updated: z.coerce.date().optional(),
    draft: z.boolean().default(false),
    category: z.string(),
    cover: z.object({ src: image(), alt: z.string() }).optional(),
  });

/** Every post, long or short. */
const writing = defineCollection({
  loader: glob({ pattern: "*.{md,mdx}", base: `${CONTENT_DIR}/writing` }),
  schema: entrySchema,
});

/** `url` is where the thing itself lives, when it lives somewhere. */
const projects = defineCollection({
  loader: glob({ pattern: "*.{md,mdx}", base: `${CONTENT_DIR}/projects` }),
  schema: (context) => entrySchema(context).extend({ url: z.url().optional() }),
});

export const collections = { writing, projects };

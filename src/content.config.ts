import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";
import { CONTENT_DIR } from "./lib/contentDir";

const entrySchema = z.object({
  title: z.string(),
  description: z.string(),
  pubDate: z.coerce.date(),
  updated: z.coerce.date().optional(),
  draft: z.boolean().default(false),
});

/** Every post, long or short; `category` is the label under its title. */
const writing = defineCollection({
  loader: glob({ pattern: "*.{md,mdx}", base: `${CONTENT_DIR}/writing` }),
  schema: entrySchema.extend({ category: z.string() }),
});

/** `url` is where the thing itself lives, when it lives somewhere. */
const projects = defineCollection({
  loader: glob({ pattern: "*.{md,mdx}", base: `${CONTENT_DIR}/projects` }),
  schema: entrySchema.extend({ url: z.url().optional() }),
});

export const collections = { writing, projects };

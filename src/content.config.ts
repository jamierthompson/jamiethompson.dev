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

const essays = defineCollection({
  loader: glob({ pattern: "*.{md,mdx}", base: `${CONTENT_DIR}/essays` }),
  schema: entrySchema,
});

const notes = defineCollection({
  loader: glob({ pattern: "*.{md,mdx}", base: `${CONTENT_DIR}/notes` }),
  schema: entrySchema,
});

const projects = defineCollection({
  loader: glob({ pattern: "*.{md,mdx}", base: `${CONTENT_DIR}/projects` }),
  schema: entrySchema,
});

export const collections = { essays, notes, projects };

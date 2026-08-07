import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const entrySchema = z.object({
  title: z.string(),
  description: z.string(),
  pubDate: z.coerce.date(),
  updated: z.coerce.date().optional(),
  draft: z.boolean().default(false),
});

const essays = defineCollection({
  loader: glob({ pattern: "*.{md,mdx}", base: "./src/content/essays" }),
  schema: entrySchema,
});

const notes = defineCollection({
  loader: glob({ pattern: "*.{md,mdx}", base: "./src/content/notes" }),
  schema: entrySchema,
});

const experiments = defineCollection({
  loader: glob({ pattern: "*.{md,mdx}", base: "./src/content/experiments" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    hypothesis: z.string(),
    status: z.enum(["active", "concluded"]).default("active"),
    started: z.coerce.date(),
    concluded: z.coerce.date().optional(),
    updated: z.coerce.date().optional(),
    repo: z.string().url().optional(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { essays, notes, experiments };

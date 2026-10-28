---
title: "Everything a post can show"
description: "A showcase post: cover image, every markdown feature, an inline figure, and a long table of contents."
pubDate: 2026-10-23
updated: 2026-10-23
category: "Showcase"
cover:
  src: "../../assets/showcase-cover.jpg"
  alt: "A weathered wooden fence line against a pale sky, with tall grass in the foreground."
---

This is a throwaway post that exercises every layout feature a plain `.md`
entry can use, so the real content that replaces it has a reference to copy
from. The photo above is the `cover` from the frontmatter; it also appears on
nothing else, because posts render as rows, not cards. Delete this file when
real writing arrives.

## Frontmatter

Every field the schema knows is set on this post:

| Field         | Required | Where it shows                            |
| ------------- | -------- | ----------------------------------------- |
| `title`       | yes      | `<h1>`, `<title>`, `og:title`, every list |
| `description` | yes      | meta description, every list              |
| `pubDate`     | yes      | under the title, every list, sort order   |
| `updated`     | no       | under the title, after the date           |
| `category`    | yes      | under the title, the index filter         |
| `cover`       | no       | under the title                           |
| `draft`       | no       | `true` removes the entry from every route |

> A blockquote. The `updated` date prints under the title only on the entry
> page; lists show the original date, which is what they sort by.

## Inline images

A relative image in the body runs through Astro's image pipeline the same way
the cover does: it is resized, converted, and served with `width` and `height`
so the page does not jump while it loads. On a wide screen it bleeds past the
text column on both sides.

![A second landscape, bleeding past the text column.](../../assets/showcase-figure.jpg)

Above `xl` the table of contents sits in a rail to the left; below that it
collapses into the row above the text. Scroll and the rail tracks the heading
you are at.

### A nested heading

Third-level headings nest in the table of contents. This one exists mostly to
show that.

### Another nested heading

And this one shows what two siblings look like under a parent.

## Code

Fenced code is highlighted at build time with Shiki, so no JavaScript ships
for it. On a wide screen a block bleeds past the text column like a figure.

```ts
import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const writing = defineCollection({
  loader: glob({ pattern: "*.{md,mdx}", base: "./src/content/writing" }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      cover: z.object({ src: image(), alt: z.string() }).optional(),
    }),
});
```

Inline code like `pnpm run build` gets a tinted chip rather than backticks.

## Lists and emphasis

- A bullet, with **bold**, _italic_ and ~~struck~~ text.
- A bullet with a nested list:
  - one
  - two
- A bullet with a [plain internal link](/writing/) and an
  [external link](https://docs.astro.build/en/guides/images/) that gets the
  leaving-the-site marker.

1. A numbered list
2. with three
3. items

- [x] GitHub-flavored task lists work
- [ ] and unchecked ones render too

## Links between entries

Wikilinks resolve by slug: [[hello-world]] is a post, and [[components-in-mdx|this one]] uses custom link
text. Each of those pages lists this post under "Referenced by".

A footnote[^1] renders at the bottom of the page.

## Typography

"Straight quotes" become curly ones, dashes -- become en dashes, and three
dots... become an ellipsis, all at build time.

---

A horizontal rule above, and a long final section below so the table of
contents has something to track at the end of the page.

## The last section

Lorem ipsum stands in for prose here. The point is that this section is short
enough that it never reaches the top of the viewport, and the rail still marks
it current once you hit the bottom of the page.

[^1]: This is the footnote. It links back to where it was referenced.

# jamiethompson.design

Projects, essays and notes, linked to each other.
Built with [Astro](https://astro.build).

## Stack

- **Astro** — static output; interactive islands only where a page embeds a demo
- **Content collections** — `projects/`, `essays/` and `notes/` as markdown/MDX with typed frontmatter
- **Wikilinks** — `[[slug]]` resolves to whichever collection holds that slug, with a
  build-time backlink index. Slugs are unique across collections (the build fails on a
  collision); a link to an unwritten slug lands in `/notes/` and renders with the `new` class
- **Tailwind CSS v4** via `@tailwindcss/vite`, with `@tailwindcss/typography` for prose
- **Geist / Geist Mono**, self-hosted at build time by Astro's Fonts API
- **Prettier** (formatting), **Vitest** (unit tests), **Playwright** (primary-flow E2E)

## Theming

Design tokens live in `src/styles/global.css` — shadcn/ui's neutral base color,
so registry components drop in unchanged. Raw values are CSS variables on `:root`
(light) and `.dark`, mapped into Tailwind in `@theme inline` (`bg-background`,
`text-muted-foreground`, …). Every color is a `name` / `name-foreground` pair;
add new ones under both `:root` and `.dark`, wrapped in `oklch()`.

Dark mode is class-based. An inline script in `src/layouts/Base.astro` sets
`.dark` on `<html>` before first paint, and `SchemeToggle.astro` offers
Light / Dark / Auto (Auto follows the OS and is the default). Both read the
`scheme` localStorage key.

## Develop

Node is pinned in `.nvmrc` — run `nvm use` (or `nvm install`) in the repo root
and your shell matches CI and Vercel.

```sh
pnpm install
pnpm run dev        # local dev server
pnpm run build      # production build to dist/
pnpm run preview    # serve the production build
pnpm run format     # prettier --write
```

## The gate

Run this before pushing — GitHub Actions runs the same commands in the same
order, so green locally means green in CI:

```sh
pnpm run format:check
pnpm run check       # astro check — typecheck .astro and .ts
pnpm run test        # vitest
pnpm run test:e2e    # builds, then playwright against the preview server
```

`test:e2e` always starts its own `astro preview` on port 4331, not Astro's
default 4321 — a backgrounded `astro dev` sits there for days, and testing it
would test HMR output and an injected dev toolbar instead of the build that
ships. It also builds with `CONTENT_DIR=./e2e/fixtures/content`, so the specs
assert on fixture entries that exist for them — renaming or deleting real
writing never breaks the gate. Playwright only ever probes the port it is given, so the move alone is
what keeps the dev server out of it; `reuseExistingServer: false` then makes a
stale process still holding 4331 fail the run loudly instead of being reused.

Every pull request runs the `gate` job (`.github/workflows/ci.yml`) plus
Vercel's build-and-deploy check.

## Structure

```
src/
  components/       # shared components
  content/          # projects, essays and notes (the actual writing)
  content.config.ts # the collection schemas
  layouts/          # the page shell — head tags, nav, tokens
  lib/              # build-time helpers, tests beside them
  pages/            # routes
  styles/           # global.css — Tailwind entry and design tokens
```

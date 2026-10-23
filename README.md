# jamiethompson.dev

Projects and writing.
Built with [Astro](https://astro.build).

## Stack

- **Astro** — static output; React islands (`@astrojs/react`) where a page needs one
- **shadcn/ui** — `components.json` at the root, components in `src/components/ui/`, added
  with `pnpm dlx shadcn@latest add <name>`
- **Content collections** — `projects/` and `writing/` as markdown/MDX with typed frontmatter.
  Both require a `category` (what the index pages filter by) and take an optional `cover`
  (`src` + `alt`), shown on the card and at the top of the page; projects also take an
  optional `url` to the shipped project. Image files live in `src/assets/` and are
  referenced by relative path, so Astro resizes and converts them at build time (that
  needs `sharp`, a dependency of this project)
- **Featured content** — `src/content/featured.yaml` lists, in order, which projects and
  posts the home page shows. The build fails on a slug that doesn't exist, is a draft, or
  is listed twice
- **Wikilinks** — `[[slug]]` resolves to whichever collection holds that slug, with a
  build-time backlink index. The build fails on a slug claimed by two collections, and on
  a link to a slug no collection holds
- **Tailwind CSS v4** via `@tailwindcss/vite`, with `@tailwindcss/typography` for prose
  and `tw-animate-css` for the shadcn component animations
- **Geist / Geist Mono**, self-hosted at build time by Astro's Fonts API
- **Prettier** (formatting), **Vitest** (unit tests), **Playwright** (primary-flow E2E)

## Theming

Design tokens live in `src/styles/global.css`. Raw values are CSS variables on `:root` (light)
and `.dark`, mapped into Tailwind in `@theme inline` (`bg-background`,
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

`test:e2e` builds with the fixture content, which rewrites `.astro/content-modules.mjs`
to list the fixtures — a dev server left running would then fail to render any real MDX
entry. Playwright's `globalTeardown` (`e2e/global-teardown.ts`) runs `astro sync`
afterwards to put it back. `test:e2e` always starts its own `astro preview` on port 4331, not Astro's
default 4321 — a backgrounded `astro dev` sits there for days, and testing it
would test HMR output and an injected dev toolbar instead of the build that
ships. It also builds with `CONTENT_DIR=./e2e/fixtures/content`, so the specs
assert on fixture entries that exist for them — renaming or deleting real
writing never breaks the gate. Playwright only ever probes the port it is given, so the move alone is
what keeps the dev server out of it; `reuseExistingServer: false` then makes a
stale process still holding 4331 fail the run loudly instead of being reused.

Every pull request runs the `gate` job (`.github/workflows/ci.yml`) plus
Vercel's build-and-deploy check.

## Deploy

Vercel project `jamiethompson.dev`, connected to this
repo: every push to `main` deploys to production, every pull request gets a
preview. The canonical host is `jamiethompson.dev` — it is `SITE_URL` in
`src/lib/site.ts` — and `www.jamiethompson.dev`, `jamiethompson.design`, `www.jamiethompson.design`, `jamiethompsondesign.com`
and `www.jamiethompsondesign.com` 308-redirect to it.

## Structure

```
src/
  components/       # shared components
  content/          # projects and writing, plus featured.yaml
  content.config.ts # the collection schemas
  layouts/          # Base.astro and Entry.astro
  lib/              # build-time helpers, tests beside them
  pages/            # routes
  styles/           # global.css — Tailwind entry and design tokens
```

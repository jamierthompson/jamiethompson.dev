# jamiethompson.dev

Where I write about the things I build: short notes and longer essays.
Built with [Astro](https://astro.build).

## Stack

- **Astro** — static output; interactive islands only where a page embeds a demo
- **Content collections** — `essays/` and `notes/` as markdown/MDX with typed frontmatter
- **Wikilinks** — `[[slug]]` links resolve to notes, with a build-time backlink index
- **Prettier** (formatting), **Vitest** (unit tests), **Playwright** (primary-flow E2E)

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
ships. Playwright only ever probes the port it is given, so the move alone is
what keeps the dev server out of it; `reuseExistingServer: false` then makes a
stale process still holding 4331 fail the run loudly instead of being reused.

Every pull request runs the `gate` job (`.github/workflows/ci.yml`) plus
Vercel's build-and-deploy check.

## Structure

```
src/
  components/       # shared components
  content/          # essays and notes (the actual writing)
  content.config.ts # the collection schemas
  layouts/          # the page shell — head tags, nav, tokens
  lib/              # build-time helpers, tests beside them
  pages/            # routes
```

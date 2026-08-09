# jamiethompson.dev

A lab notebook in public: experiments with their data, short backlinked notes, and
longer essays. Built with [Astro](https://astro.build).

Three content types, three jobs: **experiments** (living pages — hypothesis, data, outcome),
**notes** (one idea each), **essays** (the longer arguments
and case studies).

## Stack

- **Astro** — static output; interactive islands only where a page embeds a demo
- **Content collections** — `experiments/`, `essays/`, `notes/` as markdown/MDX with typed frontmatter
- **Wikilinks** — `[[slug]]` links resolve to notes, with a build-time backlink index
- **Prettier** (formatting), **Vitest** (unit tests), **Playwright** (primary-flow E2E)

## Develop

Node is pinned in `.nvmrc` — run `nvm use` (or `nvm install`) in the repo root
and your shell matches CI and Vercel.

```sh
npm install
npm run dev        # local dev server
npm run build      # production build to dist/
npm run preview    # serve the production build
npm run format     # prettier --write
```

## The gate

Run this before pushing — GitHub Actions runs the same commands in the same
order, so green locally means green in CI:

```sh
npm run format:check
npm run test        # vitest
npm run test:e2e    # builds, then playwright against the preview server
```

Every pull request runs the `gate` job (`.github/workflows/ci.yml`) plus
Vercel's build-and-deploy check.

## Structure

```
src/
  content/         # essays and notes (the actual writing)
  pages/           # routes
```

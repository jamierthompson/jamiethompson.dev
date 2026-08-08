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

```sh
npm install
npm run dev        # local dev server
npm run build      # production build to dist/
npm run preview    # serve the production build
npm run format     # prettier --write
```

## Structure

```
src/
  content/         # essays and notes (the actual writing)
  pages/           # routes
```

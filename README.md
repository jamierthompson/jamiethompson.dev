# jamiethompson.dev

A lab notebook in public: AI-product experiments with their data, short backlinked field
notes, and the essays they produce. Built with [Astro](https://astro.build).

Three content types, three jobs: **experiments** (living pages — hypothesis, data, outcome),
**notes** (one atomic lesson each, written the day it lands), **essays** (case studies and
arguments, citing the other two). The pipeline: do the work → note the lesson → experiment
accumulates data → essay synthesizes.

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
staging/           # source material being ported into content/ — temporary
```

`staging/` holds material carried over from earlier repos while it's edited into
publishable entries; it ships nothing and disappears when the port is done.

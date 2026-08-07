# jamiethompson.dev

Personal site: essays and case studies about directing coding agents, plus a garden of
backlinked field notes. Built with [Astro](https://astro.build).

## Stack

- **Astro** — static output; interactive islands only where an essay embeds a demo
- **Content collections** — `essays/` and `notes/` as markdown/MDX with typed frontmatter
- **Wikilinks** — `[[slug]]` links between entries, with a build-time backlink index
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

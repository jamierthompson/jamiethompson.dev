import { execFileSync } from "node:child_process";

/**
 * `test:e2e` builds with `CONTENT_DIR` pointed at the fixtures, and that
 * build rewrites `.astro/content-modules.mjs` — the map a running dev server
 * imports to render MDX entries — to list the fixtures instead of the real
 * content. Every real MDX page then fails with
 * `UnknownContentCollectionError` until the map is regenerated. A sync
 * against the real content puts it back, and the dev server picks the new
 * map up on the next request.
 *
 * The content *store* is not shared: the dev server keeps its own under
 * `.astro/`, while builds and `astro sync` use `node_modules/.astro/`
 * (astro/dist/content/paths.js), so the fixture build never touches the
 * dev server's entries.
 *
 * `CONTENT_DIR` is dropped from the environment so this syncs the real
 * content even when the whole script was run with the variable exported.
 */
export default function globalTeardown(): void {
  const { CONTENT_DIR: _fixtures, ...env } = process.env;
  execFileSync("pnpm", ["exec", "astro", "sync"], { env, stdio: "inherit" });
}

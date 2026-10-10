import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

/**
 * Read `dist/` directly rather than navigating: a dangling internal link is a
 * property of what the build emitted, so one pass over the files covers every
 * page without a navigation each.
 */
const DIST = "dist";

// Files only. A recursive listing yields directories too, and `/writing` would
// then pass by matching a directory as though it were a static asset rather
// than by resolving to a route.
const files = readdirSync(DIST, { recursive: true, withFileTypes: true })
  .filter((entry) => entry.isFile())
  .map((entry) => join(entry.parentPath, entry.name).slice(DIST.length + 1));

const pages = files.filter((file) => file.endsWith("index.html"));
const routes = new Set(
  pages.map((file) => `/${file.slice(0, -"index.html".length)}`),
);
const assets = new Set(files.map((file) => `/${file}`));

/** `astro preview` serves `/writing/x` and `/writing/x/` alike, so both resolve. */
function resolves(target: string): boolean {
  return routes.has(target) || routes.has(`${target}/`) || assets.has(target);
}

function rootRelativeHrefs(html: string): string[] {
  return [...html.matchAll(/<a\b[^>]*\bhref="(\/[^"]*)"[^>]*>/g)].map(
    (match) => match[1],
  );
}

test("every root-relative link resolves to a page the build emitted", () => {
  // A glob that silently matched nothing would pass this vacuously. The
  // fixtures build the home page, two posts and a project.
  expect(pages.length).toBeGreaterThanOrEqual(4);

  const dangling: string[] = [];
  for (const page of pages) {
    const route = `/${page.slice(0, -"index.html".length)}`;
    for (const href of rootRelativeHrefs(
      readFileSync(join(DIST, page), "utf8"),
    )) {
      // A fragment or query narrows where a link lands within a page; the page
      // is what has to exist.
      const target = href.replace(/[#?].*$/, "");
      if (target === "" || resolves(target)) continue;
      dangling.push(`${route} → ${href}`);
    }
  }

  expect(dangling).toEqual([]);
});

test("no wikilink renders as a link to an entry that does not exist", () => {
  // remark-wiki-link appends `new` to the class of a target missing from
  // `permalinks`, so an unwritten entry is visible in the markup rather than
  // only as a 404 someone has to click to find.
  const unresolved: string[] = [];
  for (const page of pages) {
    const route = `/${page.slice(0, -"index.html".length)}`;
    const html = readFileSync(join(DIST, page), "utf8");
    for (const match of html.matchAll(/<a\b[^>]*\bclass="([^"]*)"[^>]*>/g)) {
      if (/\bnew\b/.test(match[1])) unresolved.push(`${route}: ${match[0]}`);
    }
  }

  expect(unresolved).toEqual([]);
});

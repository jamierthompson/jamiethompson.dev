import { readdirSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { SITE_URL } from "../src/lib/site";

/**
 * Asserted against the built HTML, like the external-link contract: the tags
 * are generated at build time from `Astro.url`, and `astro preview` serves
 * those files from localhost — so reading the DOM here proves what a crawler
 * would fetch from the deployed origin, not what the dev server improvises.
 */
const routes = readdirSync("dist", { recursive: true })
  .filter((entry): entry is string => typeof entry === "string")
  .filter((entry) => entry.endsWith("index.html"))
  .map((entry) => `/${entry.slice(0, -"index.html".length)}`);

/** A route with a path segment, where a relative canonical would show up. */
const NESTED_ROUTE = "/essays/agent-team-skill-eval/";
const NESTED_TITLE =
  "I evaluated my own AI agent orchestration tool and it lost twice";
/** The suffix every page but the index appends to its `<title>`. */
const TITLE_SUFFIX = " — Jamie Thompson";

type HeadMeta = {
  canonical: string | null;
  canonicalCount: number;
  og: Record<string, string>;
  twitterCard: string | null;
  description: string | null;
  title: string;
  /** Every `content` that shipped empty, keyed by the tag that shipped it. */
  emptyContent: string[];
};

async function readHead(page: import("@playwright/test").Page) {
  return page.evaluate<HeadMeta>(() => {
    const canonicalLinks = [
      ...document.querySelectorAll<HTMLLinkElement>('link[rel="canonical"]'),
    ];
    const og: Record<string, string> = {};
    for (const meta of document.querySelectorAll<HTMLMetaElement>(
      "meta[property]",
    )) {
      og[meta.getAttribute("property") ?? ""] =
        meta.getAttribute("content") ?? "";
    }
    const emptyContent: string[] = [];
    for (const meta of document.querySelectorAll<HTMLMetaElement>("meta")) {
      const content = meta.getAttribute("content");
      // `<meta charset>` carries no `content` at all; only a tag that declares
      // one and leaves it blank is a broken tag.
      if (content !== null && content.trim() === "") {
        emptyContent.push(
          meta.getAttribute("property") ?? meta.getAttribute("name") ?? "?",
        );
      }
    }
    for (const link of canonicalLinks) {
      if ((link.getAttribute("href") ?? "").trim() === "") {
        emptyContent.push("canonical");
      }
    }
    return {
      canonical: canonicalLinks[0]?.getAttribute("href") ?? null,
      canonicalCount: canonicalLinks.length,
      og,
      twitterCard:
        document
          .querySelector('meta[name="twitter:card"]')
          ?.getAttribute("content") ?? null,
      description:
        document
          .querySelector('meta[name="description"]')
          ?.getAttribute("content") ?? null,
      title: document.title,
      emptyContent,
    };
  });
}

test.describe("the canonical URL", () => {
  test("the canonical URL is absolute and names the route, on every page", async ({
    page,
  }) => {
    // A glob that silently matched nothing would pass this test vacuously.
    expect(routes.length).toBeGreaterThan(5);

    const violations: string[] = [];
    for (const route of routes) {
      await page.goto(route);
      const head = await readHead(page);
      const expected = `${SITE_URL}${route}`;

      if (head.canonicalCount !== 1) {
        violations.push(`${route}: ${head.canonicalCount} canonical links`);
      }
      if (head.canonical !== expected) {
        violations.push(
          `${route}: canonical ${head.canonical} !== ${expected}`,
        );
      }
      // `new URL(pathname, SITE_URL)` cannot double a slash, but a later switch
      // to string concatenation could, and `//notes/` is a different page.
      if (head.canonical && /(?<!:)\/\//.test(head.canonical)) {
        violations.push(`${route}: canonical has a doubled slash`);
      }
      if (head.og["og:url"] !== head.canonical) {
        violations.push(`${route}: og:url ${head.og["og:url"]} !== canonical`);
      }
    }
    expect(violations).toEqual([]);
  });

  test("the index canonical is the bare origin with one trailing slash", async ({
    page,
  }) => {
    // The index is the route where a naive join produces `//` or drops the
    // slash entirely, so it gets its own literal assertion.
    await page.goto("/");
    const head = await readHead(page);
    expect(head.canonical).toBe(`${SITE_URL}/`);
    expect(head.og["og:url"]).toBe(`${SITE_URL}/`);
  });

  test("the slashless URL of a page points its canonical at the slashed one", async ({
    page,
  }) => {
    // `astro preview` serves `/notes` and `/notes/` as the same 200, which is
    // two URLs for one page — deduplicating them is the canonical's whole job,
    // so the slashless one has to name the slashed one and not itself.
    const response = await page.goto("/notes");
    expect(response?.status()).toBe(200);

    const head = await readHead(page);
    expect(head.canonical).toBe(`${SITE_URL}/notes/`);
    expect(head.og["og:url"]).toBe(`${SITE_URL}/notes/`);
  });

  test("no page declares a canonical off the site's own origin", async ({
    page,
  }) => {
    // The canonical is the one tag that hands a crawler a different URL to
    // index. `new URL(pathname, SITE_URL)` cannot leave the origin today, but
    // a relative href or a pathname carrying an authority would, and either
    // failure reads as an SEO hand-off to somebody else's domain.
    const origin = new URL(SITE_URL).origin;
    const strays: string[] = [];

    for (const route of routes) {
      await page.goto(route);
      const head = await readHead(page);
      const canonical = head.canonical ?? "";
      let parsed: URL | null = null;
      try {
        parsed = new URL(canonical);
      } catch {
        strays.push(`${route}: canonical "${canonical}" is not absolute`);
      }
      if (parsed && parsed.origin !== origin) {
        strays.push(`${route}: canonical origin ${parsed.origin}`);
      }
      if (parsed && (parsed.search !== "" || parsed.hash !== "")) {
        strays.push(`${route}: canonical carries a query or fragment`);
      }
      if (!canonical.endsWith("/")) {
        strays.push(`${route}: canonical has no trailing slash`);
      }
    }

    expect(strays).toEqual([]);
  });
});

test.describe("the card", () => {
  test("a nested route carries the whole card, with the site named once", async ({
    page,
  }) => {
    await page.goto(NESTED_ROUTE);
    const head = await readHead(page);

    expect(head.canonical).toBe(`${SITE_URL}${NESTED_ROUTE}`);
    expect(head.og["og:type"]).toBe("website");
    expect(head.og["og:url"]).toBe(head.canonical);
    expect(head.og["og:site_name"]).toBe("Jamie Thompson");
    // `<title>` keeps the suffix for the browser tab; the card must not, or the
    // preview reads "… — Jamie Thompson" above "Jamie Thompson".
    expect(head.title).toBe(`${NESTED_TITLE}${TITLE_SUFFIX}`);
    expect(head.og["og:title"]).toBe(NESTED_TITLE);
    expect(head.og["og:description"]).toBe(head.description);
    expect(head.og["og:description"]?.length).toBeGreaterThan(0);
  });

  test("the card claims the small summary, not an image it does not have", async ({
    page,
  }) => {
    // `summary_large_image` with no `og:image` renders as a blank panel.
    const withImage: string[] = [];
    for (const route of routes) {
      await page.goto(route);
      const head = await readHead(page);
      expect(head.twitterCard, route).toBe("summary");
      if (head.og["og:image"] !== undefined) withImage.push(route);
    }
    expect(withImage).toEqual([]);
  });

  test("og:title never carries the site name twice", async ({ page }) => {
    const doubled: string[] = [];
    for (const route of routes) {
      await page.goto(route);
      const head = await readHead(page);
      const ogTitle = head.og["og:title"] ?? "";
      if (ogTitle === "") doubled.push(`${route}: no og:title`);
      if (ogTitle.endsWith(TITLE_SUFFIX)) {
        doubled.push(`${route}: og:title "${ogTitle}" repeats og:site_name`);
      }
    }
    expect(doubled).toEqual([]);
  });
});

test.describe("every tag ships once, and never empty", () => {
  test("no page ships a metadata tag with empty content", async ({ page }) => {
    const empty: string[] = [];
    for (const route of routes) {
      await page.goto(route);
      const head = await readHead(page);
      for (const tag of head.emptyContent) empty.push(`${route} → ${tag}`);
    }
    expect(empty).toEqual([]);
  });

  test("each head tag ships exactly once per page", async ({ page }) => {
    // Two canonicals, or two og:titles, is a tag a crawler resolves by its own
    // rules rather than by the layout's — the layout must not leave the choice
    // open. `readHead` already counts canonicals; this counts the rest.
    const duplicates: string[] = [];

    for (const route of routes) {
      await page.goto(route);
      const counts = await page.evaluate(() => ({
        canonical: document.querySelectorAll('link[rel="canonical"]').length,
        title: document.querySelectorAll("head title").length,
        description: document.querySelectorAll('meta[name="description"]')
          .length,
        ogTitle: document.querySelectorAll('meta[property="og:title"]').length,
        ogUrl: document.querySelectorAll('meta[property="og:url"]').length,
        ogType: document.querySelectorAll('meta[property="og:type"]').length,
        ogSiteName: document.querySelectorAll('meta[property="og:site_name"]')
          .length,
        ogDescription: document.querySelectorAll(
          'meta[property="og:description"]',
        ).length,
        twitterCard: document.querySelectorAll('meta[name="twitter:card"]')
          .length,
      }));
      for (const [tag, count] of Object.entries(counts)) {
        if (count !== 1) duplicates.push(`${route}: ${count} × ${tag}`);
      }
    }

    expect(duplicates).toEqual([]);
  });
});

test.describe("every page", () => {
  test("every page declares the language it is written in", async ({
    page,
  }) => {
    // WCAG 2.2 3.1.1 Language of Page: without it a screen reader pronounces
    // the page in whatever voice it defaulted to.
    const missing: string[] = [];
    for (const route of routes) {
      await page.goto(route);
      const lang = await page.evaluate(() =>
        document.documentElement.getAttribute("lang"),
      );
      if (!lang || lang.trim() === "") missing.push(route);
    }
    expect(missing).toEqual([]);
  });

  test("every page describes itself, on both surfaces", async ({ page }) => {
    // `description` is optional on the layout, but every collection schema
    // requires one and every call site passes one.
    const missing: string[] = [];
    for (const route of routes) {
      await page.goto(route);
      const head = await readHead(page);
      if (!head.description) missing.push(`${route}: no meta description`);
      if (!head.og["og:description"])
        missing.push(`${route}: no og:description`);
    }
    expect(missing).toEqual([]);
  });
});

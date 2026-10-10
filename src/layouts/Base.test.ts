import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { beforeAll, describe, expect, it } from "vitest";
import Base from "./Base.astro";
import { SITE_URL } from "../lib/site";

let container: AstroContainer;

beforeAll(async () => {
  container = await AstroContainer.create();
});

/**
 * `Astro.url` is `new URL(request.url)` (astro/dist/types/public/context.d.ts),
 * and the container takes that request directly (astro/dist/container/index.js)
 * — so a request is how a route is named here. The origin is deliberately not
 * the site's: it stands in for the localhost origin a dev or preview server
 * hands the layout, and proves the canonical is built from `SITE_URL` rather
 * than from wherever the page happens to be served.
 */
function render(
  props: Record<string, unknown>,
  path = "/writing/no-prior-context/",
): Promise<string> {
  return container.renderToString(Base, {
    props,
    slots: { default: "<p>body</p>" },
    request: new Request(`http://localhost:4331${path}`),
  });
}

/**
 * Every metadata tag that declares a `content`, with the value it shipped.
 * `<meta charset>` declares none at all, so a tag missing from this list is
 * fine — a tag present with an empty value is the failure.
 *
 * The value is read whether it shipped quoted or bare, because an empty string
 * ships as neither: `addAttribute` emits a valueless ` content` for `""`
 * (astro/dist/runtime/server/render/util.js), which the tokenizer then reads
 * back as `content=""` (HTML Standard §13.2.5.32). A `content="([^"]*)"` match
 * cannot see that tag at all, so the blank tag this suite exists to catch
 * would slip past the check meant to catch it.
 *
 * The tag scanner steps over quoted values rather than stopping at the first
 * `>`, because an author-controlled title can put a raw `>` inside one.
 */
function metaTags(html: string): Array<{ name: string; content: string }> {
  return [
    ...html.matchAll(/<meta ((?:"[^"]*"|'[^']*'|[^>"'])*?)\s*\/?>/gi),
  ].flatMap(([, attrs]) => {
    const declared = /(?:^|\s)content(?:="([^"]*)"|=(\S+))?(?=\s|$)/i.exec(
      attrs,
    );
    if (!declared) return [];
    return [
      {
        name: /(?:property|name)="([^"]*)"/i.exec(attrs)?.[1] ?? "?",
        content: declared[1] ?? declared[2] ?? "",
      },
    ];
  });
}

function contentAttributes(html: string): string[] {
  return metaTags(html).map((tag) => tag.content);
}

function contentOf(html: string, key: string): string | null {
  const match = html.match(
    new RegExp(`<meta (?:property|name)="${key}" content="([^"]*)"`, "i"),
  );
  return match ? match[1] : null;
}

describe("Base", () => {
  describe("the canonical URL", () => {
    it("builds the canonical from the site origin, not the serving one", async () => {
      const html = await render({ title: "A note — Jamie Thompson" });
      const canonical = html.match(/<link rel="canonical" href="([^"]*)"/)?.[1];

      expect(canonical).toBe(`${SITE_URL}/writing/no-prior-context/`);
      expect(canonical).not.toContain("localhost");
      expect(contentOf(html, "og:url")).toBe(canonical);
    });

    it("keeps the index canonical at one trailing slash", async () => {
      const html = await render({ title: "Jamie Thompson" }, "/");
      expect(html).toContain(`<link rel="canonical" href="${SITE_URL}/"`);
      expect(contentOf(html, "og:url")).toBe(`${SITE_URL}/`);
    });

    /**
     * Only `Astro.url.pathname` is taken, and the base is the site — so no
     * request can move the canonical off the site's origin or smuggle a query
     * or a fragment into it. A protocol-relative pathname is the case that
     * would: `new URL("//evil.example/", site)` is an origin swap, not a path.
     */
    it("keeps the canonical on the site's own origin, whatever the request path", async () => {
      const origin = new URL(SITE_URL).origin;
      for (const path of [
        "//evil.example.com/x/",
        "/writing/x/../../../y/",
        "/writing/x/?utm_source=q#frag",
        "/writing/%2e%2e/",
      ]) {
        const html = await render({ title: "A note — Jamie Thompson" }, path);
        const canonical =
          html.match(/<link rel="canonical" href="([^"]*)"/)?.[1] ?? "";

        expect(new URL(canonical).origin, path).toBe(origin);
        expect(canonical, path).not.toContain("?");
        expect(canonical, path).not.toContain("#");
        expect(contentOf(html, "og:url"), path).toBe(canonical);
      }
    });
  });

  describe("the title and the card title", () => {
    it("drops the title suffix for the card and keeps it in the tab", async () => {
      const html = await render({ title: "Notes — Jamie Thompson" });

      expect(html).toContain("<title>Notes — Jamie Thompson</title>");
      expect(contentOf(html, "og:title")).toBe("Notes");
      expect(contentOf(html, "og:site_name")).toBe("Jamie Thompson");
    });

    it("leaves a title that never carried the suffix alone", async () => {
      const html = await render({ title: "Jamie Thompson" }, "/");
      expect(contentOf(html, "og:title")).toBe("Jamie Thompson");
    });

    /**
     * `title` is `z.string()` with no minimum, so a frontmatter title of `""` —
     * or one that is only the suffix — leaves nothing once the suffix is cut
     * off. Each of these is a distinct way to get there.
     */
    it("fails the build on a title that reduces to nothing", async () => {
      for (const title of ["", "   ", " — Jamie Thompson"]) {
        await expect(
          render({ title }),
          `title ${JSON.stringify(title)} rendered instead of throwing`,
        ).rejects.toThrow(/needs a title of its own/);
      }
    });
  });

  describe("the description", () => {
    /**
     * Every collection schema requires a description today, so no built page
     * omits it — but an empty `og:description` is a tag a crawler reads and
     * believes.
     */
    it("omits both description tags rather than shipping them empty", async () => {
      const html = await render({ title: "Untitled — Jamie Thompson" });

      expect(html).not.toContain('name="description"');
      expect(html).not.toContain("og:description");
    });

    it("emits the description on both surfaces when it is given", async () => {
      const description = "One idea each — a rule, a lesson, an observation.";
      const html = await render({
        title: "Notes — Jamie Thompson",
        description,
      });

      expect(contentOf(html, "description")).toBe(description);
      expect(contentOf(html, "og:description")).toBe(description);
    });

    it("omits a description that is only whitespace", async () => {
      const html = await render({
        title: "A note — Jamie Thompson",
        description: "   ",
      });

      const blank = metaTags(html).filter((tag) => tag.content.trim() === "");
      expect(blank.map((tag) => tag.name)).toEqual([]);
    });
  });

  describe("what never ships empty", () => {
    it("ships no metadata tag with empty content, described or not", async () => {
      for (const props of [
        { title: "A note — Jamie Thompson" },
        { title: "A note — Jamie Thompson", description: "One idea." },
      ]) {
        const html = await render(props);
        const contents = contentAttributes(html);
        expect(contents.length, JSON.stringify(props)).toBeGreaterThan(4);
        for (const value of contents) {
          expect(
            value.trim(),
            `${JSON.stringify(props)} → empty content`,
          ).not.toBe("");
        }
      }
    });
  });

  describe("the card", () => {
    it("claims the summary card, having no image for a larger one", async () => {
      // No `og:image` exists yet (issue #5), and `summary_large_image` without
      // one renders as a blank panel.
      const html = await render({ title: "Jamie Thompson" }, "/");
      expect(contentOf(html, "twitter:card")).toBe("summary");
      expect(html).not.toContain("og:image");
    });
  });

  describe("escaping", () => {
    it("escapes a quote in the title instead of opening a new attribute", async () => {
      const html = await render({ title: 'A "quoted" title — Jamie Thompson' });
      expect(contentOf(html, "og:title")).toBe("A &quot;quoted&quot; title");
    });

    /**
     * Both surfaces take author-controlled text: `<title>` as character data,
     * the card tags as attribute values. `&` has to become `&amp;` in both, or
     * a title containing `&amp;` renders as `&`; `<` only has to be escaped in
     * the character-data one, because the attribute-value state ends at the
     * quote and nowhere else (HTML Standard §13.2.5.36).
     */
    it("escapes an ampersand and an angle bracket on both surfaces", async () => {
      const html = await render({
        title: "Ship & measure <hr> — Jamie Thompson",
        description: 'He said "no" & left',
      });

      expect(html).toContain(
        "<title>Ship &amp; measure &lt;hr&gt; — Jamie Thompson</title>",
      );
      expect(contentOf(html, "og:title")).toBe("Ship &amp; measure <hr>");
      expect(contentOf(html, "description")).toBe(
        "He said &quot;no&quot; &amp; left",
      );
      expect(contentOf(html, "og:description")).toBe(
        "He said &quot;no&quot; &amp; left",
      );
      // The tag after the angle bracket is still its own tag, not swallowed.
      expect(contentOf(html, "og:site_name")).toBe("Jamie Thompson");
    });
  });

  describe("props and isolation", () => {
    /**
     * `title` is required by the `Props` interface and `astro check` guards the
     * call sites, but nothing enforces it at runtime. `<title>undefined</title>`
     * is the outcome this refuses.
     */
    it("fails loudly rather than titling a page undefined", async () => {
      await expect(render({})).rejects.toThrow();
      await expect(render({ title: 42 })).rejects.toThrow();
    });

    /**
     * One `container` is shared by every test in this file, so a render that
     * could see another render's props would show up as a description tag on
     * the page that passed none. Interleaving them is the cheapest way to say
     * that cannot happen.
     */
    it("keeps interleaved renders independent of each other", async () => {
      const results = await Promise.all(
        Array.from({ length: 12 }, (_, index) =>
          index % 2 === 0
            ? render({ title: "Bare — Jamie Thompson" })
            : render({
                title: "Described — Jamie Thompson",
                description: "One idea.",
              }),
        ),
      );

      results.forEach((html, index) => {
        if (index % 2 === 0) {
          expect(html, `render ${index}`).not.toContain('name="description"');
          expect(html, `render ${index}`).not.toContain("og:description");
          expect(contentOf(html, "og:title"), `render ${index}`).toBe("Bare");
        } else {
          expect(contentOf(html, "og:description"), `render ${index}`).toBe(
            "One idea.",
          );
          expect(contentOf(html, "og:title"), `render ${index}`).toBe(
            "Described",
          );
        }
      });
    });
  });
});

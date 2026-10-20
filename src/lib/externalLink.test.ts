import type { Element, Root } from "hast";
import { describe, expect, it } from "vitest";
import astroConfig from "../../astro.config";
import { isExternalHref, rehypeMarkExternalLinks } from "./externalLink";
import { SITE_URL } from "./site";

/**
 * The markdown half runs through the processor `astro.config.ts` actually
 * wires up, so "the two surfaces apply one rule" is under test rather than
 * taken on trust.
 */
const renderer = await astroConfig.markdown!.processor!.createRenderer({});

interface RenderedAnchor {
  html: string;
  href: string | null;
  marked: boolean;
  target: string | null;
  rel: string | null;
  text: string;
}

async function renderAnchor(markdown: string): Promise<RenderedAnchor> {
  const { code } = await renderer.render(markdown, {});
  const anchor = /<a\b([^>]*)>([\s\S]*?)<\/a>/.exec(code);
  if (!anchor) {
    return {
      html: code,
      href: null,
      marked: false,
      target: null,
      rel: null,
      text: "",
    };
  }
  const attrs = anchor[1];
  const attr = (name: string): string | null => {
    const valued = new RegExp(`\\s${name}="([^"]*)"`).exec(attrs);
    if (valued) return valued[1];
    return new RegExp(`\\s${name}(?=[\\s>])`).test(attrs) ? "" : null;
  };
  return {
    html: code,
    href: attr("href"),
    marked: attr("data-external") !== null,
    target: attr("target"),
    rel: attr("rel"),
    text: anchor[2]
      .replace(/<[^>]*>/g, "")
      .replace(/\s+/g, " ")
      .trim(),
  };
}

/**
 * `renderAnchor` finds an anchor with `/<a\b([^>]*)>/`, which cannot cross a
 * `>` inside a quoted attribute value. These cases need the unabridged HTML.
 */
async function renderRaw(markdown: string): Promise<string> {
  const { code } = await renderer.render(markdown, {});
  return code;
}

const SITE_ORIGIN = new URL(SITE_URL).origin;
const TAB = String.fromCharCode(9);

function anchorTree(href: string): Root {
  return {
    type: "root",
    children: [
      { type: "element", tagName: "a", properties: { href }, children: [] },
    ],
  };
}

function firstAnchor(tree: Root): Element {
  const [node] = tree.children;
  if (node.type !== "element") throw new Error("expected an element");
  return node;
}

/**
 * Runs the plugin alone over a hand-built hast tree — the marking decision,
 * isolated from markdown's own escaping.
 */
async function runRehypeChain(
  href: string,
): Promise<{ href: unknown; marked: boolean }> {
  const { unified } = await import("unified");
  const tree = anchorTree(href);
  // `run` is the transform phase only, so no compiler is needed.
  await unified().use(rehypeMarkExternalLinks).run(tree);
  const node = firstAnchor(tree);
  return {
    href: node.properties.href,
    marked: node.properties.dataExternal !== undefined,
  };
}

describe("isExternalHref", () => {
  it("counts foreign http(s) URLs as leaving", () => {
    expect(isExternalHref("https://github.com/jamierthompson")).toBe(true);
    expect(isExternalHref("http://example.com")).toBe(true);
  });

  it("counts a mailto as leaving, since it hands off to another app", () => {
    expect(isExternalHref("mailto:me@example.com")).toBe(true);
    expect(isExternalHref("mailto:")).toBe(true);
  });

  it("takes the site's scheme for a protocol-relative URL", () => {
    expect(isExternalHref("//example.com/x")).toBe(true);
    expect(isExternalHref("//jamiethompson.dev/projects/")).toBe(false);
    expect(isExternalHref("//JAMIETHOMPSON.DEV/x")).toBe(false);
  });

  it("compares origins, not prefixes", () => {
    expect(isExternalHref("https://jamiethompson.dev/projects/x/")).toBe(false);
    expect(isExternalHref("https://jamiethompson.dev.example.com")).toBe(true);
    expect(isExternalHref("https://notjamiethompson.dev")).toBe(true);
  });

  it("does not let userinfo spoof the origin", () => {
    expect(isExternalHref("https://jamiethompson.dev@evil.com/")).toBe(true);
    expect(isExternalHref("https://user@jamiethompson.dev/x")).toBe(false);
  });

  it("normalizes the default port", () => {
    expect(isExternalHref("https://jamiethompson.dev:443/x")).toBe(false);
    expect(isExternalHref("https://example.com:8080")).toBe(true);
  });

  it("ignores case in the scheme and host", () => {
    expect(isExternalHref("HTTPS://JAMIETHOMPSON.DEV/x")).toBe(false);
    expect(isExternalHref("MAILTO:me@example.com")).toBe(true);
  });

  it("treats a scheme downgrade to the same host as leaving", () => {
    expect(isExternalHref("http://jamiethompson.dev/x")).toBe(true);
  });

  it("leaves same-document hrefs alone", () => {
    expect(isExternalHref("/writing/no-prior-context/")).toBe(false);
    expect(isExternalHref("#the-qa-rule")).toBe(false);
    expect(isExternalHref("")).toBe(false);
  });

  it("leaves schemes outside the rule's scope unmarked", () => {
    for (const href of [
      "tel:+15550000000",
      "ftp://example.com/file",
      "data:text/html,x",
      "blob:https://example.com/abc",
      "javascript:alert(1)",
    ]) {
      expect(isExternalHref(href)).toBe(false);
    }
  });

  it("says `stays put` for hostless and malformed URLs rather than throwing", () => {
    for (const href of ["https://", "http://", "//", "https:///", "://x"]) {
      expect(() => isExternalHref(href)).not.toThrow();
      expect(isExternalHref(href)).toBe(false);
    }
  });

  it("tolerates surrounding whitespace, including newlines and tabs", () => {
    expect(isExternalHref("  https://example.com  ")).toBe(true);
    expect(isExternalHref("\n\thttps://example.com \n")).toBe(true);
  });
});

/**
 * The rule resolves against the site the way a browser resolves the attribute,
 * so the answer matches the address bar even when the authority is somewhere
 * the naive reading of the string does not put it. Each case is checked against
 * the platform's own parser rather than an assumption about it.
 */
describe("isExternalHref resolves an href the way a browser resolves the attribute", () => {
  // WHATWG treats `\` as `/` after a special scheme, so `<a href="/\evil.com">`
  // navigates off-origin.
  it.each(["/\\example.com", "\\\\example.com", "/\\example.com/path"])(
    "counts %s as leaving, since a browser resolves it off-origin",
    (href) => {
      const resolved = new URL(href, "https://jamiethompson.dev/page/");
      expect(resolved.origin).not.toBe("https://jamiethompson.dev");
      expect(isExternalHref(href)).toBe(true);
    },
  );

  // The mirror case, and the reason the base has to be the real site: a
  // scheme-relative href whose scheme matches the base's is *relative*, so
  // `https:evil.com` stays on this origin.
  it("counts a same-scheme relative href as staying put", () => {
    expect(
      new URL("https:evil.com", "https://jamiethompson.dev/page/").origin,
    ).toBe("https://jamiethompson.dev");
    expect(isExternalHref("https:evil.com")).toBe(false);
    expect(
      new URL("http:evil.com", "https://jamiethompson.dev/page/").origin,
    ).toBe("http://evil.com");
    expect(isExternalHref("http:evil.com")).toBe(true);
  });

  it("keeps the markdown surface safe by percent-encoding the backslash", async () => {
    const anchor = await renderAnchor("[x](/\\example.com)");
    expect(anchor.href).toBe("/%5Cexample.com");
    expect(
      new URL(anchor.href!, "https://jamiethompson.dev/page/").origin,
    ).toBe("https://jamiethompson.dev");
  });

  it("cannot depend on where in the site the link was written", () => {
    // `SITE_URL` has no path; a real page does. Origin resolution ignores the
    // base's path, which is what makes the one constant base sound.
    const bases = [
      SITE_URL,
      `${SITE_URL}/`,
      `${SITE_URL}/projects/a/b/`,
      `${SITE_URL}/projects/a/b/c.html?q=1#f`,
    ];
    for (const href of [
      "..",
      "./x",
      "?q",
      "#f",
      "//evil.com",
      "/\\evil.com",
      "https:evil.com",
      "x:y",
    ]) {
      const origins = new Set(bases.map((base) => new URL(href, base).origin));
      expect(origins.size, href).toBe(1);
    }
  });
});

/**
 * The icon is a claim to the reader ("this leaves the site"), so these
 * near-misses are pinned as the deliberate reading.
 */
describe("isExternalHref on hosts near the site's own origin", () => {
  it("calls a host that only looks like ours leaving", () => {
    // Each of these really is a distinct origin, and each is reached by a
    // separate request — the trailing-dot and `www` forms redirect back.
    expect(isExternalHref("https://www.jamiethompson.dev/x")).toBe(true);
    expect(isExternalHref("https://jamiethompson.dev./x")).toBe(true);
    expect(isExternalHref("https://jamiethompson.dev:80/x")).toBe(true);
  });

  it("sees through host encodings the URL parser normalizes", () => {
    // The parser percent-decodes and IDNA-maps the host before comparing, so
    // a disguised spelling of our own host stays internal and a disguised
    // spelling of someone else's does not.
    expect(new URL("https://jamiethompson%2edev/x").origin).toBe(SITE_ORIGIN);
    expect(isExternalHref("https://jamiethompson%2edev/x")).toBe(false);
    expect(isExternalHref("https://ｊａｍｉｅｔｈｏｍｐｓｏｎ.dev/x")).toBe(
      false,
    );
    expect(isExternalHref("https://jamiethompson。dev/x")).toBe(false);
    expect(isExternalHref("https://evil%2ecom/x")).toBe(true);
    expect(isExternalHref("https://jamiethompson.dev。evil.com/")).toBe(true);
  });
});

/**
 * The direction that would actually hurt: a link the browser takes off-site
 * that the rule calls internal, so it ships with no icon and no signal.
 * Resolving against a base is the change that could have introduced one.
 */
describe("isExternalHref never calls a leaving link internal", () => {
  it("agrees with the platform parser across a seeded fuzz", () => {
    // A page deep in the site, to prove the base's *path* cannot matter.
    const page = "https://jamiethompson.dev/projects/deep/page/";
    const alphabet = [
      ..."htps:/\\.@?#%2eavilcomjd-",
      " ",
      TAB,
      String.fromCharCode(10),
      String.fromCharCode(160),
      String.fromCharCode(11),
      String.fromCharCode(1),
      String.fromCharCode(0xfeff),
    ];
    let seed = 12345;
    const rand = (): number =>
      (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;

    const missed: string[] = [];
    for (let i = 0; i < 50_000; i++) {
      const length = 1 + Math.floor(rand() * 22);
      let href = "";
      for (let j = 0; j < length; j++)
        href += alphabet[Math.floor(rand() * alphabet.length)];

      let leaves = false;
      try {
        const url = new URL(href, page);
        leaves =
          url.protocol === "mailto:" ||
          ((url.protocol === "http:" || url.protocol === "https:") &&
            url.origin !== SITE_ORIGIN);
      } catch {
        leaves = false;
      }
      if (leaves && !isExternalHref(href)) missed.push(JSON.stringify(href));
      if (missed.length > 5) break;
    }
    expect(missed).toEqual([]);
  });
});

describe("isExternalHref under abuse", () => {
  // A type-level contract only. ExternalLink is the runtime boundary and
  // rejects a non-string before it reaches here; `undefined` is the one value
  // a forgotten prop produces.
  it.each([undefined, null, 123, {}, [], true])(
    "throws a TypeError rather than guessing for %p",
    (value) => {
      expect(() => isExternalHref(value as unknown as string)).toThrow(
        TypeError,
      );
    },
  );

  it("stays linear on absurd input", () => {
    // `SCHEME_PATTERN` has no nested quantifier, so there is no backtracking
    // to blow up; this is the regression guard if it ever grows one.
    const long = `https://example.com/${"a".repeat(2_000_000)}`;
    const started = performance.now();
    expect(isExternalHref(long)).toBe(true);
    expect(isExternalHref(`${"h".repeat(200_000)}:`)).toBe(false);
    expect(performance.now() - started).toBeLessThan(2_000);
  });
});

/**
 * micromark percent-encodes a link destination on the way into hast, so
 * markdown text cannot express most of the hrefs worth attacking. These reach
 * the plugin at the hast level instead.
 */
describe("rehypeMarkExternalLinks applies isExternalHref and nothing else", () => {
  /**
   * `isExternalHref` is the only gate the pipeline applies, so the two surfaces
   * cannot disagree about an href whatever its shape. The first four are the
   * shapes that make that load-bearing: a browser sends every one of them
   * off-origin, and none of them looks like an absolute URL to a naive filter.
   */
  it.each([
    [` https://evil.com`, true],
    [`http${TAB}s://evil.com`, true],
    [`/\\evil.com`, true],
    [`\\\\evil.com`, true],
    [`https://example.com/x`, true],
    [`mailto:me@example.com`, true],
    [`//example.com/x`, true],
    [`/writing/x/`, false],
    [`#frag`, false],
    [`https://jamiethompson.dev/x`, false],
    [`tel:+15550000000`, false],
  ])(
    "marks %j exactly when the rule calls it leaving",
    async (href, leaves) => {
      expect(isExternalHref(href), href).toBe(leaves);
      const { marked } = await runRehypeChain(href);
      expect(marked, href).toBe(leaves);
    },
  );
});

describe("rehypeMarkExternalLinks on hast the markdown pipeline never emits", () => {
  const run = (properties: Record<string, unknown>, tagName = "a"): Element => {
    const tree: Root = {
      type: "root",
      children: [
        {
          type: "element",
          tagName,
          // `@types/hast` narrows `Properties['href']` to `string | undefined`
          // (index.d.ts:258), so the shapes below are exactly the ones the
          // plugin's `typeof href !== "string"` guard exists for and the ones
          // the type system says cannot arrive. Reaching them needs the cast.
          properties: properties as Element["properties"],
          children: [],
        },
      ],
    };
    rehypeMarkExternalLinks()(tree);
    return firstAnchor(tree);
  };

  const isMarked = (node: Element): boolean =>
    node.properties.dataExternal !== undefined;

  it("leaves an anchor alone when there is no string href to test", () => {
    expect(() => run({})).not.toThrow();
    for (const href of [5, null, ["a"]]) {
      expect(isMarked(run({ href })), JSON.stringify(href)).toBe(false);
    }
  });

  it("leaves every element that is not an anchor unmarked", () => {
    // Why an `<area href>` or a `<link href>` never gets the icon: the rule is
    // about links a reader clicks, and the marker is drawn by `a[data-external]`.
    for (const tagName of ["area", "link", "base"]) {
      expect(
        isMarked(run({ href: "https://evil.com" }, tagName)),
        tagName,
      ).toBe(false);
    }
  });

  it("holds no state between trees", () => {
    const transform = rehypeMarkExternalLinks();
    const external = anchorTree("https://example.com/x");
    const internal = anchorTree("/writing/x/");
    transform(external);
    transform(internal);
    expect(isMarked(firstAnchor(external))).toBe(true);
    expect(isMarked(firstAnchor(internal))).toBe(false);
  });

  it("marks an anchor once, however many times it runs", () => {
    const tree = anchorTree("https://example.com/x");
    const transform = rehypeMarkExternalLinks();
    transform(tree);
    transform(tree);
    expect(
      Object.keys(firstAnchor(tree).properties).filter((name) =>
        /^data-?external$/i.test(name),
      ),
    ).toEqual(["dataExternal"]);
  });
});

describe("the markdown surface marks what the rule calls leaving", () => {
  const leaving = [
    "https://example.com/x",
    "http://example.com/x",
    "//example.com/x",
    "https://example.com:8080/x",
    "mailto:me@example.com",
    "HTTPS://example.com/x",
    "HTTP://EXAMPLE.COM/x",
    "MAILTO:me@example.com",
  ];

  it.each(leaving)("marks %s and adds nothing else", async (href) => {
    expect(isExternalHref(href)).toBe(true);

    const anchor = await renderAnchor(`[link text](${href})`);

    expect(anchor.marked, `no data-external on ${href}`).toBe(true);
    // The marker is the whole contract: no new tab, so no `rel` to go with
    // it. The link text is the author's, untouched.
    expect(anchor.target, `${href} opened a tab`).toBeNull();
    expect(anchor.rel, `${href} got a rel`).toBeNull();
    expect(anchor.text).toBe("link text");
    expect(anchor.html).not.toContain("<span");
  });

  it.each([
    "/writing/no-prior-context/",
    "#a-heading",
    "?q=1",
    "https://jamiethompson.dev/projects/",
    "//jamiethompson.dev/projects/",
    "https://user@jamiethompson.dev/x",
    "tel:+15550000000",
  ])("leaves %s completely untouched", async (href) => {
    const anchor = await renderAnchor(`[link text](${href})`);
    expect(anchor.marked).toBe(false);
    expect(anchor.target).toBeNull();
    expect(anchor.rel).toBeNull();
    expect(anchor.text).toBe("link text");
  });

  it("marks a GFM autolinked bare URL", async () => {
    const anchor = await renderAnchor("see https://example.com/auto for more");
    expect(anchor.marked).toBe(true);
    expect(anchor.target).toBeNull();
  });

  it("marks a reference-style link", async () => {
    const anchor = await renderAnchor(
      "see [the repo][repo]\n\n[repo]: https://github.com/jamierthompson/x",
    );
    expect(anchor.marked).toBe(true);
    expect(anchor.text).toBe("the repo");
  });

  it("does not touch a URL inside inline code or a fence", async () => {
    // The negative alone would also pass if the content were dropped, so each
    // case asserts the code survived to the page first.
    const inline = await renderAnchor("`[x](https://example.com)`");
    expect(inline.html).toContain("<code>[x](https://example.com)</code>");
    expect(inline.html).not.toContain("data-external");

    const fenced = await renderAnchor(
      "```\n[x](https://example.com)\nhttps://example.com\n```",
    );
    expect(fenced.html).toMatch(/^<pre/);
    expect(fenced.html).toContain("https://example.com");
    expect(fenced.html).not.toContain("data-external");
  });

  it("does not mark a wikilink to a note", async () => {
    const anchor = await renderAnchor("[[no-prior-context]]");
    expect(anchor.href).toBe("/writing/no-prior-context/");
    expect(anchor.marked).toBe(false);
  });

  it("leaves an image-only link named by its alt text alone", async () => {
    // The alt text is the whole accessible name, so the rule must not disturb
    // it (WCAG 2.2 2.4.4 Link Purpose).
    const anchor = await renderAnchor(
      "[![Screenshot of the run](/img.png)](https://example.com)",
    );
    expect(anchor.marked).toBe(true);
    expect(anchor.html).toContain('alt="Screenshot of the run"');
    expect(anchor.text).toBe("");
  });
});

describe("the markdown surface emits the href as authored", () => {
  it("marks an uppercase scheme without rewriting the href", async () => {
    const anchor = await renderAnchor(
      "[x](HtTpS://ExAmPlE.cOm/PaTh/CaSe?Q=A#Frag)",
    );
    expect(anchor.href).toBe("HtTpS://ExAmPlE.cOm/PaTh/CaSe?Q=A#Frag");
    expect(anchor.marked).toBe(true);
  });

  it("keeps the mailbox, which RFC 5321 §2.4 makes case-sensitive", async () => {
    const anchor = await renderAnchor("[x](MAILTO:Jamie.Thompson@Example.COM)");
    expect(anchor.href).toBe("MAILTO:Jamie.Thompson@Example.COM");
    expect(anchor.marked).toBe(true);
  });

  it("leaves schemeless hrefs and wikilinks alone", async () => {
    for (const href of ["/Notes/No-Prior-Context/", "#Fragment", "?Q=A"]) {
      const anchor = await renderAnchor(`[x](${href})`);
      expect(anchor.href).toBe(href);
    }
    const wikilink = await renderAnchor("[[no-prior-context]]");
    expect(wikilink.href).toBe("/writing/no-prior-context/");
  });

  it("keeps a markdown link title and still marks the link", async () => {
    const html = await renderRaw("[x](https://example.com 'My Title')");
    expect(html).toContain('title="My Title"');
    expect(html).toContain("data-external");
  });

  it("is stable when the same source is rendered twice", async () => {
    const source = "[x](HTTPS://example.com/A)";
    const first = await renderRaw(source);
    const second = await renderRaw(source);
    expect(second).toBe(first);
    expect(first).toContain('href="HTTPS://example.com/A"');
    expect((first.match(/data-external/g) ?? []).length).toBe(1);
  });
});

describe("the markdown surface decides per link", () => {
  it("decides per link, with no marker bleeding between them", async () => {
    const { code } = await renderer.render(
      "[a](https://e.com/1) [b](/in/) [c](mailto:x@y.z) [d](https://jamiethompson.dev/x)",
      {},
    );
    const marked = [...code.matchAll(/<a\b[^>]*>/g)].map((m) =>
      m[0].includes("data-external"),
    );
    expect(marked).toEqual([true, false, true, false]);
    expect(code).not.toContain("rel=");
    expect(code).not.toContain("target=");
  });

  it("leaves an empty destination alone", async () => {
    const anchor = await renderAnchor("[x]()");
    expect(anchor.href).toBe("");
    expect(anchor.marked).toBe(false);
  });
});

describe("raw HTML anchors ship as authored and unmarked", () => {
  /**
   * Astro appends `rehype-raw` AFTER user rehype plugins
   * (@astrojs/markdown-remark/dist/index.js:83), so raw HTML is still one
   * unparsed `raw` node when these plugins run and cannot be marked. With no
   * `target` in the contract, an unmarked external anchor is a link missing an
   * icon — not a link that hijacks the reader's tab — and that is not worth a
   * build error (nor a regex over unparsed HTML pretending to agree with an
   * HTML parser).
   */
  it("ships as authored and unmarked", async () => {
    // `not.toContain("data-external")` would pass just as happily if the
    // anchor had been dropped or escaped away, so each case asserts the
    // markup reached the page as authored before asserting it went unmarked.
    for (const raw of [
      '<a href="https://example.com/raw">raw</a>',
      '<a href="HTTPS://example.com/raw">raw</a>',
      '<a title="a > b" href="https://example.com/gt">gt</a>',
      '<a href="https://example.com/greedy" data-href="/ok/">greedy</a>',
      '<!-- <a href="https://example.com/x">commented out</a> -->',
    ]) {
      const html = await renderRaw(raw);
      expect(html, raw).toContain(raw);
      expect(html, raw).not.toContain("data-external");
      expect(html, raw).not.toContain("&#x3C;a");
    }
  });

  it("are left alone when internal, which needs no treatment", async () => {
    const anchor = await renderAnchor('<a href="/writing/x/">raw</a>');
    expect(anchor.marked).toBe(false);
    expect(anchor.href).toBe("/writing/x/");
  });

  // Shiki escapes fenced content to `&#x3C;a …`, so an anchor written about
  // rather than written never reads as markup at all. Load-bearing on a site
  // that writes about code.
  it("stay code when shown in a fence", async () => {
    const fence = "```";
    for (const lang of ["html", ""]) {
      const html = await renderRaw(
        `${fence}${lang}\n<a href="https://example.com/x">link</a>\n${fence}`,
      );
      // Shiki splits the tag across highlight spans, so assert that the
      // escape is present rather than matching a tag.
      expect(html).not.toContain("data-external");
      expect(html).toContain("&#x3C;");
      expect(html).toMatch(/^<pre/);
    }
    const inline = await renderRaw(
      'Prose about `<a href="https://example.com/x">` inline.',
    );
    expect(inline).toContain("<code>");
    expect(inline).not.toContain("data-external");
  });
});

/**
 * `@astrojs/mdx` puts `[rehypeRaw, {passThrough: nodeTypes}]` *before* the
 * inherited rehype plugins (dist/plugins.js:47-65) — the opposite of `.md`,
 * where `rehype-raw` is appended last (@astrojs/markdown-remark
 * dist/index.js:83). This builds the chain Astro builds, order included.
 */
describe("the MDX chain Astro assembles", () => {
  async function compileLikeAstro(source: string): Promise<string> {
    const { createProcessor, nodeTypes } = await import("@mdx-js/mdx");
    const { default: rehypeRaw } = await import("rehype-raw");
    const processor = createProcessor({
      rehypePlugins: [
        [rehypeRaw, { passThrough: nodeTypes }],
        rehypeMarkExternalLinks,
      ],
      jsxImportSource: "astro",
      format: "mdx",
      mdExtensions: [],
      elementAttributeNameCase: "html",
    });
    return String(await processor.process(source));
  }

  it("treats a markdown-syntax link exactly as .md does", async () => {
    const compiled = await compileLikeAstro("[md](HTTPS://example.com/MD)");
    expect(compiled).toContain('href: "HTTPS://example.com/MD"');
    expect(compiled).toContain('"data-external": ""');
    expect(compiled).not.toContain("_blank");
    expect(compiled).not.toContain("rel:");
  });

  it("marks a mailto in .mdx as well", async () => {
    const compiled = await compileLikeAstro("[md](MAILTO:A@b.co)");
    expect(compiled).toContain('href: "MAILTO:A@b.co"');
    expect(compiled).toContain('"data-external": ""');
  });

  it("still cannot reach a JSX anchor, even behind rehype-raw", async () => {
    // passThrough keeps the mdxJsxTextElement a JSX node rather than turning
    // it into a hast `element`, so the plugin never sees it.
    const compiled = await compileLikeAstro(
      '<a href="HTTPS://example.com/jsx">jsx</a>',
    );
    expect(compiled).toContain('href: "HTTPS://example.com/jsx"');
    expect(compiled).not.toContain("data-external");
  });

  // @astrojs/mdx forwards `processor.options.rehypePlugins` into the MDX
  // compile (@astrojs/mdx/dist/index.js:70-74), but MDX parses `<a href>` as an
  // mdxJsxTextElement, which is not a hast `element`, so the plugin never sees
  // it. The wiring is shared; the coverage is not. The cost is a missing icon;
  // catching it would need a second traversal over a JSX AST for a form the
  // content does not use.
  it("does not reach a JSX anchor in .mdx, as it does not in .md", async () => {
    const { compile } = await import("@mdx-js/mdx");
    const compiled = String(
      await compile('<a href="https://example.com/mdx">jsx</a>', {
        rehypePlugins: [rehypeMarkExternalLinks],
      }),
    );
    expect(compiled).not.toContain("data-external");
    expect(compiled).toContain("https://example.com/mdx");
  });

  it("still marks an ordinary markdown link inside .mdx", async () => {
    const { compile } = await import("@mdx-js/mdx");
    const compiled = String(
      await compile("[md link](https://example.com/mdx)", {
        rehypePlugins: [rehypeMarkExternalLinks],
      }),
    );
    expect(compiled).toContain("data-external");
    expect(compiled).not.toContain("_blank");
  });
});

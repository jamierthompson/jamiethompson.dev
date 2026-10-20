import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { beforeAll, describe, expect, it } from "vitest";
import ExternalLink from "./ExternalLink.astro";

let container: AstroContainer;

beforeAll(async () => {
  container = await AstroContainer.create();
});

function render(
  props: Record<string, unknown>,
  text = "link text",
): Promise<string> {
  return container.renderToString(ExternalLink, {
    props,
    slots: { default: text },
  });
}

/**
 * Matched case-insensitively because the HTML tokenizer lowercases every
 * attribute name it reads (HTML Standard §13.2.5.33), so `Href` and `href` are
 * one attribute to a browser — a case-sensitive match would let a duplicate
 * hide.
 */
function attributeOccurrences(html: string, name: string): string[] {
  return [
    ...html.matchAll(new RegExp(`\\s${name}(?=[\\s=>])(?:="([^"]*)")?`, "gi")),
  ].map((match) => match[1] ?? "");
}

describe("ExternalLink", () => {
  describe("the contract it emits", () => {
    it("gives a web link the whole contract: the marker and nothing else", async () => {
      const html = await render({ href: "https://example.com/x" });
      expect(html).toContain("data-external");
      expect(attributeOccurrences(html, "target")).toEqual([]);
      expect(attributeOccurrences(html, "rel")).toEqual([]);
      expect(html).not.toContain("<span");
      expect(html).toContain(">link text</a>");
    });

    it("marks a mailto the same way, with no target and no rel", async () => {
      const html = await render({ href: "mailto:me@example.com" }, "Email me");
      expect(html).toContain("data-external");
      expect(attributeOccurrences(html, "target")).toEqual([]);
      expect(attributeOccurrences(html, "rel")).toEqual([]);
      expect(html).toContain(">Email me</a>");
    });

    it("emits each attribute it owns exactly once", async () => {
      const html = await render({ href: "https://example.com/x" });
      for (const owned of ["href", "data-external"]) {
        expect(
          attributeOccurrences(html, owned),
          `duplicate ${owned}`,
        ).toHaveLength(1);
      }
    });

    it("emits the href as authored, as the markdown surface does", async () => {
      // Both surfaces mark the link and leave the href alone, so an href renders
      // the same however it was written. Deciding is case-insensitive (RFC 3986
      // §3.1 makes the scheme so); emitting is verbatim, which is what keeps a
      // mailbox intact — RFC 5321 §2.4 makes one case-sensitive.
      const web = await render({ href: "HTTPS://ExAmPlE.cOm/PaTh?Q=A#Frag" });
      expect(attributeOccurrences(web, "href")).toEqual([
        "HTTPS://ExAmPlE.cOm/PaTh?Q=A#Frag",
      ]);
      expect(web).toContain("data-external");

      const mail = await render({ href: "MAILTO:Jamie.Thompson@Example.COM" });
      expect(attributeOccurrences(mail, "href")).toEqual([
        "MAILTO:Jamie.Thompson@Example.COM",
      ]);
      expect(mail).toContain("data-external");
    });

    it("passes an unrelated attribute through, `rel` included", async () => {
      // `rel` is not owned, which is what makes `rel="me"` — the
      // IndieAuth/Mastodon identity hook — reachable through this component.
      const html = await render({
        href: "https://example.com/x",
        class: "cta",
        rel: "me",
        "aria-describedby": "note",
      });
      expect(html).toContain('class="cta"');
      expect(attributeOccurrences(html, "rel")).toEqual(["me"]);
      expect(html).toContain('aria-describedby="note"');
    });
  });

  describe("hrefs it refuses", () => {
    it("refuses an internal href with a message naming the component", async () => {
      for (const href of [
        "/writing/x/",
        "#heading",
        "https://jamiethompson.dev/x/",
        "",
      ]) {
        await expect(render({ href })).rejects.toThrow(/ExternalLink/);
      }
    });

    it("refuses a missing href instead of crashing on `undefined.trim`", async () => {
      await expect(render({})).rejects.toThrow(/ExternalLink/);
    });

    it("refuses an href that is not a string", async () => {
      for (const href of [null, 0, 42, [], {}, true]) {
        await expect(
          render({ href }),
          `href ${JSON.stringify(href)} was accepted`,
        ).rejects.toThrow(/ExternalLink/);
      }
    });

    it("refuses an href of only whitespace", async () => {
      await expect(render({ href: "   " })).rejects.toThrow(/ExternalLink/);
    });

    it("refuses a scripting or data href", async () => {
      for (const href of [
        "javascript:alert(1)",
        "data:text/html,<script>alert(1)</script>",
        "vbscript:msgbox(1)",
      ]) {
        await expect(render({ href }), href).rejects.toThrow(/ExternalLink/);
      }
    });
  });

  describe("hrefs it accepts and marks", () => {
    /**
     * The href reaches the anchor verbatim rather than through `URL`, so this
     * is the surface where a backslash authority arrives intact — markdown
     * percent-encodes it away. `/\evil.com` resolves to `https://evil.com/`, so
     * the component must mark it, not wave it through as an internal link.
     */
    it("marks an href whose authority hides behind a backslash", async () => {
      for (const href of ["/\\example.com", "\\\\example.com"]) {
        const html = await render({ href });
        expect(html, href).toContain("data-external");
      }
    });

    it("normalizes a padded href the way it normalizes a bare one", async () => {
      const html = await render({ href: "  HTTPS://Example.com/x  " });
      expect(attributeOccurrences(html, "href")).toEqual([
        "HTTPS://Example.com/x",
      ]);
    });

    it("marks a protocol-relative href", async () => {
      const html = await render({ href: "//example.com/x" });
      expect(html).toContain("data-external");
    });
  });

  describe("attributes it owns", () => {
    it("refuses any attribute it owns, whatever the prop case", async () => {
      // A second literal `href` is not reachable — one key, last write wins,
      // before any component sees it — so the href half of the guard is only
      // ever exercised by a case variant.
      for (const key of ["HREF", "Href", "data-external", "Data-External"]) {
        await expect(
          render({
            href: "https://example.com/x",
            [key]: "https://evil.test/",
          }),
          `${key} slipped past the guard`,
        ).rejects.toThrow(/ExternalLink/);
      }
    });

    /**
     * The rehype surface writes the marker as the hast property name
     * `dataExternal` (`rehypeMarkExternalLinks`), so a caller who has read that
     * module may reach for the same spelling here. Astro's `addAttribute` emits
     * the prop name verbatim and never kebab-cases it
     * (runtime/server/render/util.js:82-84 — `kebab` is used only for style
     * objects), so it lands as `dataExternal` and cannot collide with
     * `data-external`. The guard's blind spot is harmless only for as long as
     * that stays true.
     */
    it("cannot be given a second data-external under a camelCase name", async () => {
      const html = await render({
        href: "https://example.com/x",
        dataExternal: "",
      });
      expect(attributeOccurrences(html, "data-external")).toHaveLength(1);
    });

    /**
     * A name the guard misses because `" href" !== "href"`. Astro drops it
     * before it reaches the markup — `INVALID_ATTR_NAME_CHAR` rejects any key
     * containing whitespace, quotes, `>`, `/` or `=` — so the anchor keeps what
     * this component set.
     */
    it("cannot be overridden by a whitespace-padded attribute name", async () => {
      for (const key of [" href", "href ", "href\n", "data-external "]) {
        const html = await render({
          href: "https://example.com/x",
          [key]: "https://evil.test/",
        });
        expect(attributeOccurrences(html, "href"), key).toEqual([
          "https://example.com/x",
        ]);
        expect(attributeOccurrences(html, "data-external"), key).toHaveLength(
          1,
        );
      }
    });

    it("names both the offending attribute and the href when it refuses", async () => {
      await expect(
        render({ href: "https://example.com/x", "data-external": "" }),
      ).rejects.toThrow(/data-external[\s\S]*https:\/\/example\.com\/x/);
    });
  });

  describe("target, which it refuses outright", () => {
    /**
     * This component sets no target, so a caller-supplied `target="_blank"`
     * changes context (WCAG 2.2 3.2.5) with nothing to announce it.
     */
    it("refuses target whatever its case and whatever its value", async () => {
      for (const key of ["target", "TARGET", "Target", "tArGeT"]) {
        for (const value of ["_blank", "_self", "someframe", ""]) {
          await expect(
            render({ href: "https://example.com/x", [key]: value }),
            `${key}="${value}" slipped past the guard`,
          ).rejects.toThrow(/ExternalLink/);
        }
      }
    });

    it("names target, the href, and rel's exemption when it refuses", async () => {
      // The message has to carry the asymmetry, or the next caller reads the
      // refusal as "no attributes allowed" and drops `rel="me"` with it.
      await expect(
        render({ href: "https://example.com/x", target: "_blank" }),
      ).rejects.toThrow(/target[\s\S]*https:\/\/example\.com\/x[\s\S]*rel/);
    });

    it("refuses target even when its value would not render", async () => {
      for (const value of [undefined, null, false, 0]) {
        await expect(
          render({ href: "https://example.com/x", target: value }),
          `target=${JSON.stringify(value)} slipped past the guard`,
        ).rejects.toThrow(/ExternalLink/);
      }
    });
  });

  describe("the accessible name", () => {
    /**
     * An anchor whose only content is whitespace has no accessible name at all
     * — the icon is a CSS `::after`, which contributes nothing to the name
     * (WCAG 2.2 2.4.4 Link Purpose).
     */
    it("refuses a link with no name of its own", async () => {
      for (const slot of ["", "   ", "\n"]) {
        await expect(
          render({ href: "https://example.com/x" }, slot),
          `slot ${JSON.stringify(slot)} produced a nameless link`,
        ).rejects.toThrow(/ExternalLink/);
      }
    });

    it("refuses a link with no slot at all", async () => {
      await expect(
        container.renderToString(ExternalLink, {
          props: { href: "https://example.com/x" },
        }),
      ).rejects.toThrow(/ExternalLink/);
    });

    /**
     * `aria-label` replaces the name computed from the element's contents
     * (Accessible Name and Description Computation 1.2, step 2C beats 2F), so
     * it names a link an empty slot would leave nameless.
     */
    it("accepts a label in place of link text", async () => {
      const html = await render(
        { href: "https://example.com/x", "aria-label": "GitHub" },
        "",
      );
      expect(attributeOccurrences(html, "aria-label")).toEqual(["GitHub"]);
      expect(html).toContain("data-external");
    });

    /**
     * The name check renders the slot before the anchor does. Astro hands the
     * second caller a fresh evaluation (runtime/server/render/astro/
     * instance.js), so the content must reach the page exactly once.
     */
    it("renders slot markup once, not twice and not zero times", async () => {
      const html = await render(
        { href: "https://example.com/x" },
        "<strong>bold</strong>",
      );
      expect(html.match(/<strong>bold<\/strong>/g)).toHaveLength(1);
    });

    /**
     * An `aria-label` that is empty or whitespace is discarded by the name
     * computation (accname 1.2 step 2C), so it names nothing and an empty slot
     * ships a nameless link — the WCAG 2.2 2.4.4 failure the guard exists to
     * prevent.
     */
    it("refuses an aria-label that names nothing", async () => {
      for (const label of ["", "   ", "\n"]) {
        await expect(
          render({ href: "https://example.com/x", "aria-label": label }, ""),
          `aria-label ${JSON.stringify(label)} produced a nameless link`,
        ).rejects.toThrow(/ExternalLink/);
      }

      await expect(
        render({ href: "https://example.com/x", "aria-labelledby": "" }, ""),
        "an empty aria-labelledby produced a nameless link",
      ).rejects.toThrow(/ExternalLink/);
    });

    it("accepts a label whatever the prop case, as the other guards do", async () => {
      // The owned/refused guards lowercase the prop name because the HTML
      // tokenizer does (HTML Standard §13.2.5.33); the name check has to agree,
      // or a label a browser honors is refused as if it were absent.
      for (const key of ["ARIA-LABEL", "Aria-Label", "aria-labelledby"]) {
        const html = await render(
          { href: "https://example.com/x", [key]: "GitHub" },
          "",
        );
        expect(html, key).toContain("data-external");
      }
    });
  });

  describe("escaping", () => {
    /**
     * The href is emitted verbatim rather than re-serialized through `URL`, so
     * escaping is the only thing keeping a quote inside the attribute.
     */
    it("escapes a quote in the href instead of opening a new attribute", async () => {
      const html = await render({
        href: 'https://example.com/" onmouseover="alert(1)',
      });
      expect(html).toContain(
        'href="https://example.com/&quot; onmouseover=&quot;alert(1)"',
      );
    });
  });
});

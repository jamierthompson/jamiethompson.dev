import { readdirSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { isExternalHref } from "../src/lib/externalLink";

/**
 * Enforced against the built HTML rather than the sources, so the contract
 * holds whatever wrote the anchor — the rehype plugin, ExternalLink.astro, or
 * a surface that doesn't exist yet.
 */
const routes = readdirSync("dist", { recursive: true })
  .filter((entry): entry is string => typeof entry === "string")
  .filter((entry) => entry.endsWith("index.html"))
  .map((entry) => `/${entry.slice(0, -"index.html".length)}`);

/** A markdown-authored link, the surface the rehype plugin owns. */
const MARKDOWN_LINK_ROUTE = "/writing/fixture-essay/";
const MARKDOWN_LINK_NAME = "an external reference";
/** The `.astro` surface, rendered by the component on the index page. */
const COMPONENT_LINK_NAME = "agent-conventions";

/** WCAG 2.2 1.4.11 Non-text Contrast, for a graphic that carries meaning. */
const NON_TEXT_CONTRAST_FLOOR = 3;

function channel(value: number): number {
  const srgb = value / 255;
  return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
}

/**
 * Linear-light sRGB from an `oklch(L C H)` computed value — the form Chrome
 * reports for colors authored in oklch, which the design tokens are. This is
 * the OKLab → linear sRGB matrix from Björn Ottosson's reference, clamped to
 * the sRGB gamut the page is displayed in.
 */
function oklchToLinearSrgb(color: string): [number, number, number] {
  const [l, c, h] = (color.match(/-?\d*\.?\d+(?:e-?\d+)?/g) ?? []).map(Number);
  const hue = ((h || 0) * Math.PI) / 180;
  const a = c * Math.cos(hue);
  const b = c * Math.sin(hue);
  const lms = [
    l + 0.3963377774 * a + 0.2158037573 * b,
    l - 0.1055613458 * a - 0.0638541728 * b,
    l - 0.0894841775 * a - 1.291485548 * b,
  ].map((value) => value ** 3);
  const clamp = (value: number) => Math.min(1, Math.max(0, value));
  return [
    clamp(
      4.0767416621 * lms[0] - 3.3077115913 * lms[1] + 0.2309699292 * lms[2],
    ),
    clamp(
      -1.2684380046 * lms[0] + 2.6097574011 * lms[1] - 0.3413193965 * lms[2],
    ),
    clamp(
      -0.0041960863 * lms[0] - 0.7034186147 * lms[1] + 1.707614701 * lms[2],
    ),
  ];
}

/**
 * WCAG 2.2 relative luminance, from a computed color: `rgb(r, g, b)` or
 * `oklch(L C H)`. Anything else fails loudly rather than reading as black.
 */
function luminance(color: string): number {
  if (color.startsWith("oklch(")) {
    const [r, g, b] = oklchToLinearSrgb(color);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  if (color.startsWith("rgb")) {
    const [r, g, b] = (color.match(/\d+(\.\d+)?/g) ?? []).map(Number);
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  }
  throw new Error(`luminance() cannot read the color "${color}"`);
}

function contrastRatio(a: string, b: string): number {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
}

/** WCAG 2.2 2.5.8 Target Size (Minimum), in CSS pixels. */
const TARGET_SIZE_FLOOR = 24;

test.describe("the contract, across every built page", () => {
  test("every link that leaves the site carries the external-link contract", async ({
    page,
  }) => {
    // A glob that silently matched nothing would pass this test vacuously. The
    // fixtures build the home page, two posts and a project.
    expect(routes.length).toBeGreaterThanOrEqual(4);

    const violations: string[] = [];

    for (const route of routes) {
      await page.goto(route);
      const anchors = await page.locator("a[href]").evaluateAll((elements) =>
        elements.map((element) => ({
          href: element.getAttribute("href") ?? "",
          marked: element.hasAttribute("data-external"),
          target: element.getAttribute("target"),
          rel: element.getAttribute("rel") ?? "",
          text: (element.textContent ?? "").replace(/\s+/g, " ").trim(),
        })),
      );

      for (const anchor of anchors) {
        const where = `${route} → ${anchor.href}`;

        // The whole contract, both directions: the marker marks exactly the
        // links that leave, and nothing on the page opens a tab the reader did
        // not ask for (WCAG 2.2 3.2.5 On Input — a new tab is a change of
        // context, and the choice is theirs to make with cmd-click).
        if (isExternalHref(anchor.href)) {
          if (!anchor.marked)
            violations.push(`${where}: missing data-external`);
        } else if (anchor.marked) {
          violations.push(`${where}: internal link marked`);
        }
        if (anchor.target) violations.push(`${where}: sets target`);
        if (anchor.rel.split(/\s+/).includes("noopener")) {
          violations.push(
            `${where}: sets rel=noopener, for a tab it never opens`,
          );
        }
      }
    }

    expect(violations).toEqual([]);
  });

  test("the contract covers a real number of links, not zero", async ({
    page,
  }) => {
    // The test above uses `isExternalHref` as its own oracle, so a rule that
    // regressed to always returning false would pass it with nothing checked.
    // The fixture content carries one markdown-authored external link and the
    // home page one component-rendered link, so both surfaces must be marked.
    let marked = 0;
    for (const route of routes) {
      await page.goto(route);
      marked += await page.locator("a[data-external]").count();
    }
    expect(marked).toBeGreaterThanOrEqual(2);
  });

  test("every marked link has an accessible name", async ({ page }) => {
    // The icon is a CSS `::after` and contributes nothing to the name, so a link
    // with no text tells a screen-reader user nothing at all (WCAG 2.2 2.4.4
    // Link Purpose).
    const nameless: string[] = [];
    for (const route of routes) {
      await page.goto(route);
      const links = await page
        .locator("a[data-external]")
        .evaluateAll((elements) =>
          elements.map((element) => ({
            href: element.getAttribute("href") ?? "",
            text: (element.textContent ?? "").replace(/\s+/g, " ").trim(),
            label: element.getAttribute("aria-label") ?? "",
            alt: [...element.querySelectorAll("img[alt]")]
              .map((image) => image.getAttribute("alt") ?? "")
              .join(""),
          })),
        );
      for (const link of links) {
        if (!link.text && !link.label && !link.alt.trim()) {
          nameless.push(`${route} → ${link.href}`);
        }
      }
    }
    expect(nameless).toEqual([]);
  });

  test("no route logs an error or fails a request", async ({ page }) => {
    // A rendered surface is not done while the console is dirty — and the
    // icon is a data URL in CSS, exactly the kind of asset that fails quietly.
    const problems: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error" || message.type() === "warning") {
        problems.push(`console.${message.type()}: ${message.text()}`);
      }
    });
    page.on("pageerror", (error) =>
      problems.push(`pageerror: ${error.message}`),
    );
    page.on("requestfailed", (request) =>
      problems.push(`requestfailed: ${request.url()}`),
    );

    for (const route of routes) {
      await page.goto(route);
    }

    expect(problems).toEqual([]);
  });
});

test.describe("the accessible name", () => {
  test("the accessible name is the author's text, on both surfaces", async ({
    page,
  }) => {
    // Read from the accessibility tree rather than textContent, so anything
    // appended to the name fails here. `exact` is what makes that true.
    await page.goto("/");
    await expect(
      page.getByRole("link", { name: COMPONENT_LINK_NAME, exact: true }),
    ).toBeVisible();

    await page.goto(MARKDOWN_LINK_ROUTE);
    await expect(
      page.getByRole("link", { name: MARKDOWN_LINK_NAME, exact: true }),
    ).toBeVisible();
  });
});

test.describe("the marker", () => {
  test("the marker renders as a sized, link-colored icon", async ({ page }) => {
    await page.goto("/");
    const link = page.getByRole("link", { name: COMPONENT_LINK_NAME });

    const marker = await link.evaluate((element) => {
      const style = getComputedStyle(element, "::after");
      return {
        mask: style.maskImage,
        width: Number.parseFloat(style.width),
        color: style.backgroundColor,
        linkColor: getComputedStyle(element).color,
      };
    });

    expect(marker.mask).toContain("svg");
    expect(marker.width).toBeGreaterThan(6);
    expect(marker.color).toBe(marker.linkColor);
  });

  test("the icon does not wrap onto a line of its own", async ({ page }) => {
    // The icon is an inline-block after the link text with nothing preventing a
    // line break in front of it, so a narrow viewport can orphan it.
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto(MARKDOWN_LINK_ROUTE);

    const orphans = await page
      .locator("a[data-external]")
      .evaluateAll((elements) =>
        elements
          .filter((element) => {
            const rects = [...element.getClientRects()];
            if (rects.length < 2) return false;
            const style = getComputedStyle(element, "::after");
            const iconWidth = Number.parseFloat(style.width) || 0;
            const marginStart = Number.parseFloat(style.marginInlineStart) || 0;
            const last = rects[rects.length - 1];
            return last.width <= iconWidth + marginStart + 1;
          })
          .map((element) => element.getAttribute("href") ?? ""),
      );

    expect(orphans).toEqual([]);
  });

  test("the icon sits after the text in LTR and before it in RTL", async ({
    page,
  }) => {
    // `margin-inline-start` is the whole reason this is direction-safe; a
    // regression to `margin-left` only shows up under `dir="rtl"`.
    await page.goto(MARKDOWN_LINK_ROUTE);
    const link = page.getByRole("link", { name: MARKDOWN_LINK_NAME });

    const ltr = await link.evaluate((element) => {
      const style = getComputedStyle(element, "::after");
      return { left: style.marginLeft, right: style.marginRight };
    });
    expect(Number.parseFloat(ltr.left)).toBeGreaterThan(0);
    expect(Number.parseFloat(ltr.right)).toBe(0);

    const rtl = await link.evaluate((element) => {
      document.documentElement.setAttribute("dir", "rtl");
      const style = getComputedStyle(element, "::after");
      const measured = { left: style.marginLeft, right: style.marginRight };
      document.documentElement.removeAttribute("dir");
      return measured;
    });
    expect(Number.parseFloat(rtl.right)).toBeGreaterThan(0);
    expect(Number.parseFloat(rtl.left)).toBe(0);
  });

  /**
   * Every icon assertion above reads computed style, and computed style is
   * unchanged by a mask image that fails to parse: `mask-image` still reports
   * the URL, the box still reports its width, and the element paints nothing.
   * Decoding the asset is what tells the two apart.
   */
  test("the mask asset is an image the browser can decode", async ({
    page,
  }) => {
    await page.goto(MARKDOWN_LINK_ROUTE);
    const decoded = await page
      .getByRole("link", { name: MARKDOWN_LINK_NAME })
      .evaluate(async (element) => {
        const mask = getComputedStyle(element, "::after").maskImage;
        const url = mask.match(/url\((['"]?)(.*?)\1\)/)?.[2] ?? "";
        const image = new Image();
        image.src = url;
        try {
          await image.decode();
        } catch (error) {
          return { ok: false, reason: String(error), width: 0, height: 0 };
        }
        return {
          ok: true,
          reason: "",
          width: image.naturalWidth,
          height: image.naturalHeight,
        };
      });

    expect(decoded.reason).toBe("");
    expect(decoded.ok).toBe(true);
    expect(decoded.width).toBeGreaterThan(0);
    expect(decoded.height).toBeGreaterThan(0);
  });

  /**
   * The strongest statement available without a reference screenshot: the
   * pixels where the icon sits change when the paint is taken away, so
   * something is being drawn there. `background-color: transparent` removes
   * the paint without moving a single box, which keeps the clip comparable.
   */
  test("the marker paints pixels, not just computed style", async ({
    page,
  }) => {
    await page.goto(MARKDOWN_LINK_ROUTE);
    const link = page.getByRole("link", { name: MARKDOWN_LINK_NAME });
    // A clip is read against the viewport, so the icon has to be inside it.
    await link.scrollIntoViewIfNeeded();

    const clip = await link.evaluate((element) => {
      const rects = [...element.getClientRects()];
      const last = rects[rects.length - 1];
      const after = getComputedStyle(element, "::after");
      const iconWidth = Number.parseFloat(after.width);
      return {
        x: Math.floor(last.right - iconWidth - 1),
        y: Math.floor(last.top),
        width: Math.ceil(iconWidth + 2),
        height: Math.ceil(last.height),
      };
    });

    expect(clip.x).toBeGreaterThanOrEqual(0);
    expect(clip.y).toBeGreaterThanOrEqual(0);

    // `animations: "disabled"` fast-forwards the entrance fade to its end;
    // mid-fade, both shots can catch the column still transparent.
    const painted = await page.screenshot({ clip, animations: "disabled" });
    await page.addStyleTag({
      content: "a[data-external]::after { background-color: transparent; }",
    });
    const unpainted = await page.screenshot({ clip, animations: "disabled" });

    expect(painted.equals(unpainted)).toBe(false);
  });

  /**
   * The marker is one global rule keyed on an attribute, so it has to hold for
   * the shapes a link can take that today's content does not contain yet: one
   * whose last child is an image, one inside a heading, one that is a flex
   * item. These are injected rather than authored — the rule under test is the
   * CSS, and the CSS cannot tell where the anchor came from.
   */
  test("the marker survives the shapes a link can take", async ({ page }) => {
    await page.goto("/");
    const measured = await page.evaluate(() => {
      const holder = document.createElement("div");
      holder.innerHTML = `
      <p><a id="probe-image" href="https://example.com/" data-external><img src="/favicon.svg" alt="Example" width="16" height="16"></a></p>
      <h2 style="font-size: 1.5em"><a id="probe-heading" href="https://example.com/" data-external>heading link</a></h2>
      <div style="display: flex; gap: 1rem"><a id="probe-flex" href="https://example.com/" data-external>flex link</a><span>after</span></div>
    `;
      document.querySelector("main")?.append(holder);

      return ["probe-image", "probe-heading", "probe-flex"].map((id) => {
        const element = document.getElementById(id) as HTMLElement;
        const after = getComputedStyle(element, "::after");
        return {
          id,
          content: after.content,
          width: Number.parseFloat(after.width),
          height: Number.parseFloat(after.height),
          color: after.backgroundColor,
          mask: after.maskImage,
          linkColor: getComputedStyle(element).color,
          fontSize: Number.parseFloat(getComputedStyle(element).fontSize),
        };
      });
    });

    expect(measured).toHaveLength(3);
    for (const shape of measured) {
      expect(shape.content, shape.id).toBe('""');
      expect(shape.mask, shape.id).toContain("svg");
      expect(shape.color, shape.id).toBe(shape.linkColor);
      // 0.72em, so the icon tracks the type it sits in rather than a fixed px.
      expect(
        Math.abs(shape.width - shape.fontSize * 0.72),
        `${shape.id}: ${shape.width}px against ${shape.fontSize}px type`,
      ).toBeLessThan(1);
      expect(shape.height, shape.id).toBeGreaterThan(6);
    }

    // The heading's icon is bigger than the body's, or it is not scaling.
    const [image, heading] = measured;
    expect(heading.width).toBeGreaterThan(image.width);
  });

  test("the icon is still laid out under print media", async ({ page }) => {
    // Proves no print rule collapses the pseudo-element. Whether the mask
    // appears on paper depends on the reader's "background graphics" setting,
    // which no automated check can assert.
    await page.goto(MARKDOWN_LINK_ROUTE);
    await page.emulateMedia({ media: "print" });
    const printed = await page
      .getByRole("link", { name: MARKDOWN_LINK_NAME })
      .evaluate((element) => ({
        printActive: matchMedia("print").matches,
        width: Number.parseFloat(getComputedStyle(element, "::after").width),
      }));
    expect(printed.printActive).toBe(true);
    expect(printed.width).toBeGreaterThan(6);
  });
});

test.describe("the marker under color schemes", () => {
  test("the icon survives forced-colors mode", async ({ browser }) => {
    // Forced colors overrides `background-color` to Canvas, which would paint
    // the mask invisibly against the page. WCAG 2.2 1.4.11 wants >= 3:1 for a
    // graphic that carries meaning.
    const context = await browser.newContext({ forcedColors: "active" });
    const page = await context.newPage();
    await page.goto(MARKDOWN_LINK_ROUTE);
    const painted = await page
      .getByRole("link", { name: MARKDOWN_LINK_NAME })
      .evaluate((element) => {
        const style = getComputedStyle(element, "::after");
        return {
          forcedColorsActive: matchMedia("(forced-colors: active)").matches,
          background: style.backgroundColor,
          pageBackground: getComputedStyle(document.body).backgroundColor,
          linkColor: getComputedStyle(element).color,
          mask: style.maskImage,
          width: Number.parseFloat(style.width),
        };
      });
    await context.close();

    // Guard against the assertions below passing because the mode never applied.
    expect(painted.forcedColorsActive).toBe(true);
    expect(painted.mask).toContain("svg");
    expect(painted.width).toBeGreaterThan(6);
    expect(painted.background).not.toBe(painted.pageBackground);
    expect(painted.background).toBe(painted.linkColor);
  });

  for (const scheme of ["light", "dark"] as const) {
    test(`the icon clears 3:1 against the page in ${scheme} mode`, async ({
      browser,
    }) => {
      // The mask is painted with `background-color: currentColor`, so the icon
      // is only ever as visible as the link text — and the link color is
      // re-bound per scheme.
      const context = await browser.newContext({ colorScheme: scheme });
      const page = await context.newPage();
      await page.goto(MARKDOWN_LINK_ROUTE);
      const painted = await page
        .getByRole("link", { name: MARKDOWN_LINK_NAME })
        .evaluate((element) => ({
          schemeMatched: matchMedia("(prefers-color-scheme: dark)").matches,
          icon: getComputedStyle(element, "::after").backgroundColor,
          pageBackground: getComputedStyle(document.body).backgroundColor,
        }));
      await context.close();

      // Guard against the assertions below passing because the emulation
      // never applied and both runs measured the same page.
      expect(painted.schemeMatched).toBe(scheme === "dark");
      expect(
        contrastRatio(painted.icon, painted.pageBackground),
      ).toBeGreaterThan(NON_TEXT_CONTRAST_FLOOR);
    });
  }
});

test.describe("focus and the keyboard path", () => {
  test("a focused external link shows a ring and is not obscured", async ({
    page,
  }) => {
    await page.goto("/");
    const link = page.getByRole("link", { name: COMPONENT_LINK_NAME });
    await link.focus();

    const focused = await link.evaluate((element) => {
      const style = getComputedStyle(element);
      // A wrapped inline link's union box spans the gap between its
      // fragments, so hit-test each fragment rather than the union.
      const covered = [...element.getClientRects()].filter((rect) => {
        const hit = document.elementFromPoint(
          rect.left + rect.width / 2,
          rect.top + rect.height / 2,
        );
        return !element.contains(hit);
      });
      return {
        isFocused: document.activeElement === element,
        matchesFocusVisible: element.matches(":focus-visible"),
        outlineStyle: style.outlineStyle,
        outlineWidth: Number.parseFloat(style.outlineWidth),
        outlineColor: style.outlineColor,
        pageBackground: getComputedStyle(document.body).backgroundColor,
        fragments: element.getClientRects().length,
        obscuredFragments: covered.length,
      };
    });

    expect(focused.isFocused).toBe(true);
    expect(focused.matchesFocusVisible).toBe(true);
    expect(focused.outlineStyle).not.toBe("none");
    expect(focused.outlineWidth).toBeGreaterThanOrEqual(2);
    expect(
      contrastRatio(focused.outlineColor, focused.pageBackground),
    ).toBeGreaterThan(NON_TEXT_CONTRAST_FLOOR);
    expect(focused.fragments).toBeGreaterThan(0);
    expect(focused.obscuredFragments).toBe(0);
  });

  /**
   * `.focus()` is not how a reader gets there. WCAG 2.2 2.4.7 and 2.4.11 are
   * about the keyboard path: the link has to be reachable by Tab, and the ring
   * has to be visible when it is.
   */
  test("a marked link is reachable by keyboard and rings when it lands", async ({
    page,
  }) => {
    await page.goto(MARKDOWN_LINK_ROUTE);
    await page.locator("body").click({ position: { x: 1, y: 1 } });

    const MAX_TABS = 60;
    let landed = false;
    for (let press = 0; press < MAX_TABS && !landed; press += 1) {
      await page.keyboard.press("Tab");
      landed = await page.evaluate(
        (name) =>
          document.activeElement?.tagName === "A" &&
          document.activeElement.hasAttribute("data-external") &&
          (document.activeElement.textContent ?? "").trim() === name,
        MARKDOWN_LINK_NAME,
      );
    }
    expect(landed, `never tabbed onto "${MARKDOWN_LINK_NAME}"`).toBe(true);

    const ring = await page.evaluate(() => {
      const element = document.activeElement as HTMLElement;
      const style = getComputedStyle(element);
      const rects = [...element.getClientRects()];
      const obscured = rects.filter((rect) => {
        const hit = document.elementFromPoint(
          rect.left + rect.width / 2,
          rect.top + rect.height / 2,
        );
        return !element.contains(hit);
      });
      return {
        focusVisible: element.matches(":focus-visible"),
        style: style.outlineStyle,
        width: Number.parseFloat(style.outlineWidth),
        color: style.outlineColor,
        pageBackground: getComputedStyle(document.body).backgroundColor,
        obscured: obscured.length,
        inViewport: rects.every(
          (rect) => rect.top >= 0 && rect.bottom <= window.innerHeight,
        ),
      };
    });

    expect(ring.focusVisible).toBe(true);
    expect(ring.style).not.toBe("none");
    expect(ring.width).toBeGreaterThanOrEqual(2);
    expect(contrastRatio(ring.color, ring.pageBackground)).toBeGreaterThan(
      NON_TEXT_CONTRAST_FLOOR,
    );
    expect(ring.obscured).toBe(0);
    expect(ring.inViewport).toBe(true);
  });
});

test.describe("target size", () => {
  test("the header's toggle and an entry's back button clear the minimum target size", async ({
    page,
  }) => {
    // The inline exception covers links inside a sentence; these controls sit
    // alone, so they are measured against the floor.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/writing/fixture-essay/");

    const controls = page.locator(
      'header button, a[href="/"][aria-label="Home"]',
    );
    await expect(controls).toHaveCount(4);
    const small = await controls.evaluateAll(
      (elements, floor) =>
        elements
          .map((element) => ({
            name:
              element.getAttribute("aria-label") ??
              (element.textContent ?? "").trim(),
            rect: element.getBoundingClientRect(),
          }))
          .filter(({ rect }) => rect.width < floor || rect.height < floor)
          .map(({ name, rect }) => `${name}: ${rect.width}×${rect.height}`),
      TARGET_SIZE_FLOOR,
    );

    expect(small).toEqual([]);
  });
});

test.describe("activation", () => {
  test("activating an external link stays in the same tab", async ({
    page,
    context,
  }) => {
    // The decision itself, observed rather than inferred from an attribute:
    // the reader keeps their tab and their back button. The off-site request
    // is aborted so this does not depend on GitHub; the abort is at the
    // network, not at the click, so a `target="_blank"` would still have
    // opened a tab this counts.
    await context.route(/^https:\/\/github\.com\//, (route) => route.abort());
    await page.goto("/");
    const before = context.pages().length;

    await page
      .getByRole("link", { name: COMPONENT_LINK_NAME })
      .click({ noWaitAfter: true });
    await page.waitForTimeout(500);

    expect(context.pages()).toHaveLength(before);
  });
});

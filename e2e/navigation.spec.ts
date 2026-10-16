import { expect, test, type Page } from "@playwright/test";

const SECTIONS = [
  { label: "Projects", path: "/projects/", heading: "Projects" },
  { label: "Writing", path: "/writing/", heading: "Writing" },
] as const;

test.describe("the header", () => {
  test("links every section and names the current one", async ({ page }) => {
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Site" });
    for (const { label, path, heading } of SECTIONS) {
      await nav.getByRole("link", { name: label }).click();
      await expect(page).toHaveURL(new RegExp(`${path}$`));
      await expect(
        page.getByRole("heading", { level: 1, name: heading }),
      ).toBeVisible();
      await expect(nav.getByRole("link", { name: label })).toHaveAttribute(
        "aria-current",
        "page",
      );
    }
  });

  test("an entry page marks its section as current", async ({ page }) => {
    await page.goto("/writing/fixture-essay/");
    const nav = page.getByRole("navigation", { name: "Site" });
    await expect(nav.getByRole("link", { name: "Writing" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(
      nav.getByRole("link", { name: "Projects" }),
    ).not.toHaveAttribute("aria-current");
  });

  test("the name goes home", async ({ page }) => {
    await page.goto("/writing/");
    await page
      .getByRole("banner")
      .getByRole("link", { name: "Jamie Thompson" })
      .click();
    await expect(page).toHaveURL(/\/$/);
  });
});

/**
 * The menu button belongs to a React island hydrated with `client:load`, so
 * a click that lands before hydration is a click on dead markup. Astro drops
 * the island's `ssr` attribute once it has hydrated.
 */
async function openDrawer(page: Page) {
  await page.waitForFunction(() =>
    [...document.querySelectorAll("astro-island")].every(
      (island) => !island.hasAttribute("ssr"),
    ),
  );
  await page.getByRole("button", { name: "Open navigation" }).click();
}

test.describe("the drawer", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("replaces the inline nav below the breakpoint", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("navigation", { name: "Site" })).toBeHidden();

    const open = page.getByRole("button", { name: "Open navigation" });
    await expect(open).toHaveAttribute("aria-expanded", "false");
    await openDrawer(page);

    const drawer = page.getByRole("dialog", { name: "Navigation" });
    await expect(drawer).toBeVisible();
    // The page behind a modal is hidden from the accessibility tree, trigger
    // included, so the open state is read off the element directly.
    await expect(
      page.locator('button[aria-label="Open navigation"]'),
    ).toHaveAttribute("aria-expanded", "true");
    for (const { label } of SECTIONS) {
      await expect(drawer.getByRole("link", { name: label })).toBeVisible();
    }
    // The scheme toggle lives in the drawer here, not in the bar.
    await expect(
      drawer.getByRole("group", { name: "Color scheme" }),
    ).toBeVisible();
  });

  test("closes on its own button and on Escape", async ({ page }) => {
    await page.goto("/");
    const open = page.getByRole("button", { name: "Open navigation" });
    const drawer = page.getByRole("dialog", { name: "Navigation" });

    await openDrawer(page);
    await drawer.getByRole("button", { name: "Close navigation" }).click();
    await expect(drawer).toBeHidden();
    await expect(open).toHaveAttribute("aria-expanded", "false");

    await openDrawer(page);
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
  });

  test("a drawer link navigates", async ({ page }) => {
    await page.goto("/");
    await openDrawer(page);
    await page
      .getByRole("dialog", { name: "Navigation" })
      .getByRole("link", { name: "Projects" })
      .click();
    await expect(page).toHaveURL(/\/projects\/$/);
  });

  test("the drawer's scheme toggle works, and the page does not scroll behind it", async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/writing/fixture-essay/");
    await openDrawer(page);
    await page
      .getByRole("dialog", { name: "Navigation" })
      .getByRole("button", { name: "Dark" })
      .click();
    expect(
      await page.evaluate(() =>
        document.documentElement.classList.contains("dark"),
      ),
    ).toBe(true);
    expect(
      await page.evaluate(() => getComputedStyle(document.body).overflow),
    ).toBe("hidden");
  });
});

test.describe("the footer", () => {
  test("is one line: the copyright, then the contact links", async ({
    page,
  }) => {
    await page.goto("/");
    const footer = page.getByRole("contentinfo");
    await expect(footer).toContainText(
      `© ${new Date().getUTCFullYear()} Jamie Thompson`,
    );
    for (const name of ["GitHub", "LinkedIn", "Email"]) {
      await expect(footer.getByRole("link", { name })).toHaveAttribute(
        "data-external",
        "",
      );
    }
    // At desktop width the copyright and the last link share a row.
    const copyright = await footer.getByText(/^©/).boundingBox();
    const email = await footer
      .getByRole("link", { name: "Email" })
      .boundingBox();
    expect(copyright).not.toBeNull();
    expect(email).not.toBeNull();
    expect(Math.abs(copyright!.y - email!.y)).toBeLessThan(4);
  });
});

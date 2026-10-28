import { expect, test } from "@playwright/test";

test.describe("the writing index", () => {
  test("lists every post, newest first", async ({ page }) => {
    await page.goto("/writing/");
    await expect(
      page.getByRole("main").getByRole("listitem").getByRole("link"),
    ).toHaveText([/A fixture note/, /A fixture essay/]);
  });

  test("the category filter narrows the list and lands in the URL", async ({
    page,
  }) => {
    await page.goto("/writing/");
    const filter = page.getByRole("group", { name: "Filter by category" });
    const note = page.getByRole("link", { name: /A fixture note/ });
    const essay = page.getByRole("link", { name: /A fixture essay/ });

    await expect(filter.getByRole("button", { name: "All" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await filter.getByRole("button", { name: "Notes" }).click();
    await expect(note).toBeVisible();
    await expect(essay).toBeHidden();
    await expect(page).toHaveURL(/\?category=Notes$/);

    // The URL is enough to come back to the same view.
    await page.reload();
    await expect(filter.getByRole("button", { name: "Notes" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(essay).toBeHidden();

    await filter.getByRole("button", { name: "All" }).click();
    await expect(essay).toBeVisible();
    await expect(page).not.toHaveURL(/category=/);
  });

  test("an unknown category in the URL shows everything", async ({ page }) => {
    await page.goto("/writing/?category=Nope");
    await expect(
      page.getByRole("link", { name: /A fixture note/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /A fixture essay/ }),
    ).toBeVisible();
  });

  test("without scripts every post is listed and the filter stays out of the way", async ({
    browser,
  }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto("/writing/");
    await expect(
      page.getByRole("group", { name: "Filter by category" }),
    ).toBeHidden();
    await expect(
      page.getByRole("link", { name: /A fixture note/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /A fixture essay/ }),
    ).toBeVisible();
    await context.close();
  });
});

test.describe("the table of contents", () => {
  test("at desktop widths it is a rail that follows the reader", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/writing/fixture-essay/");
    const toc = page.getByRole("navigation", { name: "Table of Contents" });
    await expect(toc).toBeVisible();
    await expect(toc.getByRole("link")).toHaveText([
      "A heading",
      "A subheading",
      "Another heading",
    ]);

    await toc.getByRole("link", { name: "Another heading" }).click();
    await expect(page).toHaveURL(/#another-heading$/);
    await expect(
      toc.getByRole("link", { name: "Another heading" }),
    ).toHaveAttribute("aria-current", "location");
    await expect(
      toc.getByRole("link", { name: "A heading" }),
    ).not.toHaveAttribute("aria-current");
  });

  test("at narrow widths it folds into a row above the text", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/writing/fixture-essay/");
    const details = page.locator("details", { hasText: "Table of Contents" });
    await expect(details).toBeVisible();
    await expect(details.getByRole("link", { name: "A heading" })).toBeHidden();
    await details.locator("summary").click();
    await expect(
      details.getByRole("link", { name: "A heading" }),
    ).toBeVisible();
  });

  test("a page with no headings has no table of contents", async ({ page }) => {
    await page.goto("/writing/fixture-note/");
    await expect(
      page.getByRole("navigation", { name: "Table of Contents" }),
    ).toBeHidden();
    await expect(page.locator("details")).toHaveCount(0);
  });
});

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

test.describe("the projects index", () => {
  test("lists each project with the same filter as writing, and opens it", async ({
    page,
  }) => {
    await page.goto("/projects/");
    const filter = page.getByRole("group", { name: "Filter by category" });
    await expect(filter.getByRole("button")).toHaveText(["All", "Fixtures"]);
    await filter.getByRole("button", { name: "Fixtures" }).click();
    await expect(page).toHaveURL(/\?category=Fixtures$/);
    await page.getByRole("link", { name: /A fixture project/ }).click();
    await expect(page).toHaveURL(/\/projects\/fixture-project\/$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "A fixture project" }),
    ).toBeVisible();
  });
});

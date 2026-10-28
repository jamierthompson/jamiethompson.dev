import { expect, test } from "@playwright/test";

test("home page renders and the console is clean", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 1, name: /Jamie Thompson/ }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

/**
 * These run against `e2e/fixtures/content` (see `test:e2e`), so they assert on
 * entries that exist for them rather than on whatever the writing is today.
 */
test("primary flow: home → writing → a post → the post it links, which links back", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "Site" })
    .getByRole("link", { name: "Writing" })
    .click();
  await page.getByRole("link", { name: /A fixture note/ }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "A fixture note" }),
  ).toBeVisible();

  await page
    .getByRole("article")
    .getByRole("link", { name: "A fixture essay" })
    .click();
  await expect(
    page.getByRole("heading", { level: 1, name: "A fixture essay" }),
  ).toBeVisible();

  const backlinks = page.getByRole("complementary");
  await expect(
    backlinks.getByRole("heading", { name: "Referenced by" }),
  ).toBeVisible();
  await expect(
    backlinks.getByRole("link", { name: "A fixture note" }),
  ).toBeVisible();
});

test("below the nav breakpoint, an entry's back link returns to its index", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/writing/fixture-essay/");
  // Scoped to main: the header carries a "Writing" link of its own.
  await page
    .getByRole("main")
    .getByRole("link", { name: "Writing", exact: true })
    .click();
  await expect(page).toHaveURL(/\/writing\/$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Writing" }),
  ).toBeVisible();
});

test("at desktop widths the header nav is the way back, and the back link is gone", async ({
  page,
}) => {
  await page.goto("/writing/fixture-essay/");
  await expect(
    page.getByRole("main").getByRole("link", { name: "Writing", exact: true }),
  ).toBeHidden();
  await page
    .getByRole("navigation", { name: "Site" })
    .getByRole("link", { name: "Writing" })
    .click();
  await expect(page).toHaveURL(/\/writing\/$/);
});

test("a wikilink reaches the post it names, and that post lists the source as a backlink", async ({
  page,
}) => {
  await page.goto("/writing/fixture-essay/");
  await page
    .getByRole("article")
    .getByRole("link", { name: "the fixture note" })
    .click();
  await expect(page).toHaveURL(/\/writing\/fixture-note\/$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "A fixture note" }),
  ).toBeVisible();
  await expect(
    page.getByRole("complementary").getByRole("link", {
      name: "A fixture essay",
    }),
  ).toBeVisible();
});

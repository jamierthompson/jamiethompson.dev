import { expect, test } from "@playwright/test";

test("home page renders and the console is clean", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 1, name: "Jamie Thompson" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

/**
 * These run against `e2e/fixtures/content` (see `test:e2e`), so they assert on
 * entries that exist for them rather than on whatever the writing is today.
 */
test("primary flow: home → a post → the post it links, which links back", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("region", { name: "Writing" })
    .getByRole("link", { name: /A fixture note/ })
    .click();
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

test("the home page lists both collections, and each entry opens", async ({
  page,
}) => {
  for (const [section, entry] of [
    ["Projects", "A fixture project"],
    ["Writing", "A fixture essay"],
  ] as const) {
    await page.goto("/");
    await page
      .getByRole("region", { name: section })
      .getByRole("link", { name: new RegExp(entry) })
      .click();
    await expect(
      page.getByRole("heading", { level: 1, name: entry }),
    ).toBeVisible();
  }
});

test("an entry's back button returns home", async ({ page }) => {
  await page.goto("/writing/fixture-essay/");
  await page.getByRole("link", { name: "Home" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Jamie Thompson" }),
  ).toBeVisible();
});

test("a wikilink reaches a project, and the project lists the post as a backlink", async ({
  page,
}) => {
  await page.goto("/writing/fixture-note/");
  await page
    .getByRole("article")
    .getByRole("link", { name: "A fixture project" })
    .click();
  await expect(page).toHaveURL(/\/projects\/fixture-project\/$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "A fixture project" }),
  ).toBeVisible();
  await expect(
    page.getByRole("complementary").getByRole("link", {
      name: "A fixture note",
    }),
  ).toBeVisible();
});

test("a project's wikilink resolves into the writing collection", async ({
  page,
}) => {
  await page.goto("/projects/fixture-project/");
  await expect(
    page.getByRole("article").getByRole("link", { name: "A fixture essay" }),
  ).toHaveAttribute("href", "/writing/fixture-essay/");
});

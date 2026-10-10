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
test("primary flow: home → notes → a note → the essay it links, which links back", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Notes" })
    .click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Notes" }),
  ).toBeVisible();

  await page.getByRole("link", { name: "A fixture note" }).click();
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

test("a wikilink reaches a project, and the project lists the note as a backlink", async ({
  page,
}) => {
  await page.goto("/notes/fixture-note/");
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

test("a project's wikilink resolves into the essays collection", async ({
  page,
}) => {
  await page.goto("/projects/fixture-project/");
  await expect(
    page.getByRole("article").getByRole("link", { name: "A fixture essay" }),
  ).toHaveAttribute("href", "/essays/fixture-essay/");
});

for (const [route, heading, entry] of [
  ["/projects/", "Projects", "A fixture project"],
  ["/essays/", "Essays", "A fixture essay"],
] as const) {
  test(`${heading.toLowerCase()} index links to an entry, and the link opens it`, async ({
    page,
  }) => {
    await page.goto(route);
    await expect(
      page.getByRole("heading", { level: 1, name: heading }),
    ).toBeVisible();
    await page.getByRole("link", { name: entry }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: entry }),
    ).toBeVisible();
  });
}

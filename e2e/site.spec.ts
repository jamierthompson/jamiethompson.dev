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

test("primary flow: home → field notes → a note", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Notes" })
    .click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Field notes" }),
  ).toBeVisible();

  await page.getByRole("link", { name: /Briefing your reviewer/ }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: /Briefing your reviewer/ }),
  ).toBeVisible();
  await expect(page.getByRole("article")).toContainText(
    "no prior context of the work",
  );
});

test("essays index renders its empty state without breaking", async ({
  page,
}) => {
  await page.goto("/essays/");
  await expect(
    page.getByRole("heading", { level: 1, name: "Essays" }),
  ).toBeVisible();
});

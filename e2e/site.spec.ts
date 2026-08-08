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

test("primary flow: home → notes → rule-note → worked-case essay", async ({
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

  await page.getByRole("link", { name: /no prior context/i }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: /no prior context/i }),
  ).toBeVisible();

  await page
    .getByRole("article")
    .getByRole("link", { name: /Briefing your AI reviewer/ })
    .click();
  await expect(
    page.getByRole("heading", { level: 1, name: /Briefing your AI reviewer/ }),
  ).toBeVisible();
  await expect(page.getByRole("article")).toContainText(
    "no prior context of the work",
  );

  const backlinks = page.getByRole("complementary");
  await expect(
    backlinks.getByRole("heading", { name: "Referenced by" }),
  ).toBeVisible();
  await expect(
    backlinks.getByRole("link", { name: /no prior context/i }),
  ).toBeVisible();
});

test("essays index lists the worked case", async ({ page }) => {
  await page.goto("/essays/");
  await expect(
    page.getByRole("heading", { level: 1, name: "Essays" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Briefing your AI reviewer/ }),
  ).toBeVisible();
});

test("experiments index lists the concluded runs and a page states its hypothesis", async ({
  page,
}) => {
  await page.goto("/experiments/");
  await expect(
    page.getByRole("heading", { level: 1, name: "Experiments" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "Concluded" }),
  ).toBeVisible();

  await page
    .getByRole("link", {
      name: /I evaluated my own AI agent orchestration tool/,
    })
    .click();
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: /I evaluated my own AI agent orchestration tool/,
    }),
  ).toBeVisible();
  await expect(page.getByRole("article")).toContainText("Hypothesis:");
  await expect(page.getByRole("article")).toContainText("Concluded");
});

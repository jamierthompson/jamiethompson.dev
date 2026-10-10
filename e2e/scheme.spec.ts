import { expect, test, type Page } from "@playwright/test";

const isDark = (page: Page) =>
  page.evaluate(() => document.documentElement.classList.contains("dark"));

const toggle = (page: Page) =>
  page.getByRole("group", { name: "Color scheme" });

test("Auto is the default and follows the OS preference", async ({
  browser,
}) => {
  for (const colorScheme of ["light", "dark"] as const) {
    const context = await browser.newContext({ colorScheme });
    const page = await context.newPage();
    await page.goto("/");
    expect(await isDark(page)).toBe(colorScheme === "dark");
    await expect(
      toggle(page).getByRole("button", { name: "Auto" }),
    ).toHaveAttribute("aria-pressed", "true");
    await context.close();
  }
});

test("Auto keeps following the OS after the page has loaded", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  expect(await isDark(page)).toBe(false);
  await page.emulateMedia({ colorScheme: "dark" });
  await expect.poll(() => isDark(page)).toBe(true);
});

test("a pinned scheme overrides the OS and survives a reload", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await toggle(page).getByRole("button", { name: "Dark" }).click();
  expect(await isDark(page)).toBe(true);

  await page.reload();
  expect(await isDark(page)).toBe(true);
  await expect(
    toggle(page).getByRole("button", { name: "Dark" }),
  ).toHaveAttribute("aria-pressed", "true");

  await toggle(page).getByRole("button", { name: "Auto" }).click();
  expect(await isDark(page)).toBe(false);
});

test("a stored scheme is applied before first paint", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.addInitScript(() => localStorage.setItem("scheme", "dark"));
  // Read the class from the first script that runs after the head, before
  // any deferred module has had a chance to correct it.
  await page.addInitScript(() => {
    document.addEventListener("readystatechange", () => {
      if (document.readyState === "interactive") {
        (window as { darkAtParse?: boolean }).darkAtParse =
          document.documentElement.classList.contains("dark");
      }
    });
  });
  await page.goto("/");
  expect(
    await page.evaluate(
      () => (window as { darkAtParse?: boolean }).darkAtParse,
    ),
  ).toBe(true);
});

test("the toggle stays hidden when scripts cannot run", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/");
  await expect(toggle(page)).toBeHidden();
  await context.close();
});

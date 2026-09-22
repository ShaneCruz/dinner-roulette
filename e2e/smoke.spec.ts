import { expect, test, type Page } from "@playwright/test";

/**
 * Opens every page as a parent and fails on any crash, so a page that only
 * breaks when visited (like a server/client mix-up) is caught before deploy.
 */

const ERROR_TEXT = "Well, that spilled";

async function signInAsParent(page: Page) {
  await page.goto("/sign-in");
  if (page.url().endsWith("/sign-in")) {
    await page.getByRole("button", { name: "Sign in as developer" }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/sign-in"));
  }

  if (new URL(page.url()).pathname === "/setup") {
    await page.getByPlaceholder("The Hungry Hendersons").fill("The Smoke Testers");
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "Done" }).click();
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "Finish setup" }).click();
    await page.waitForURL("/");
  }

  // Land somewhere stable, then pick a profile if the device doesn't have one.
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  if (new URL(page.url()).pathname === "/who") {
    await page.locator("main li button").filter({ hasNotText: "PIN" }).first().click();
    await page.waitForURL((url) => url.pathname === "/");
  }
  expect(new URL(page.url()).pathname, "signed in and picked a profile").toBe("/");
}

async function expectHealthy(page: Page, path: string) {
  const response = await page.goto(path);
  expect(response?.status(), `${path} status`).toBeLessThan(500);
  // A redirect to the picker or sign-in would hide a broken page.
  expect(new URL(page.url()).pathname, `${path} redirected`).toBe(new URL(path, "http://x").pathname);
  await expect(page.getByText(ERROR_TEXT), `${path} shows the error screen`).toHaveCount(0);
  await expect(page.locator("main, body").first()).toBeVisible();
}

test("every page opens without crashing", async ({ page }) => {
  // The dev server compiles each page on first visit.
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`${page.url()}: ${error.message}`));

  await signInAsParent(page);

  const staticPaths = [
    "/",
    "/plan",
    "/plan/print",
    "/grocery",
    "/history",
    "/recipes",
    "/recipes?kind=side",
    "/recipes/new",
    "/recipes/import",
    "/takeout",
    "/takeout/spin",
    "/family",
    "/family/new",
    "/settings",
  ];
  for (const path of staticPaths) await expectHealthy(page, path);

  // A recipe, its editor and print view
  await page.goto("/recipes");
  const firstRecipe = await page.locator('a[href^="/recipes/"]:not([href="/recipes/new"])').first().getAttribute("href");
  expect(firstRecipe).toBeTruthy();
  for (const suffix of ["", "/edit", "/print"]) await expectHealthy(page, `${firstRecipe}${suffix}`);

  // A family member's page
  await page.goto("/family");
  const firstMember = await page.locator('a[href^="/family/"]:not([href="/family/new"])').first().getAttribute("href");
  if (firstMember) await expectHealthy(page, firstMember);

  // A restaurant, if any
  await page.goto("/takeout");
  const restaurantLinks = page.locator('a[href^="/takeout/"]:not([href="/takeout/spin"])');
  if (await restaurantLinks.count()) await expectHealthy(page, (await restaurantLinks.first().getAttribute("href"))!);

  // A cooked dinner's rating page, if there is one
  await page.goto("/history");
  const rateLinks = page.locator('a[href^="/rate/"]');
  if (await rateLinks.count()) await expectHealthy(page, (await rateLinks.first().getAttribute("href"))!);

  // Grocery print only exists once a week has a plan
  await page.goto("/grocery");
  if (await page.getByRole("link", { name: /Print/ }).count()) {
    await expectHealthy(page, "/grocery/print");
  }

  expect(errors, "uncaught browser errors").toEqual([]);
});

import { test, expect } from "@playwright/test";

test("home page opens", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Cellbytes/);
});

test("the hero swaps between the demo loop and the narrated intro", async ({
  page,
}) => {
  await page.goto("/");
  const demo = page.locator("#demo-video");
  const intro = page.locator("#intro-video");
  const toggle = page.getByRole("button", { name: "Show me more" });
  await expect(intro).toHaveClass(/inactive/);

  await toggle.click();
  await expect(
    page.getByRole("button", { name: "Back to the demo" }),
  ).toBeVisible();
  // The narrated intro plays with sound; the demo pauses behind it.
  await expect(intro).not.toHaveClass(/inactive/);
  await expect(intro).toHaveJSProperty("muted", false);
  await expect(demo).toHaveClass(/inactive/);
  await expect(demo).toHaveJSProperty("paused", true);

  await page.getByRole("button", { name: "Back to the demo" }).click();
  await expect(demo).not.toHaveClass(/inactive/);
  await expect(intro).toHaveClass(/inactive/);
  await expect(intro).toHaveJSProperty("paused", true);
  await expect(toggle).toBeVisible();
});

test.describe("desktop", { tag: "@desktop" }, () => {
  test.skip(({ isMobile }) => isMobile);

  test("navigation is visible", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("navigation")).toBeVisible();
    // Use-cases is a disclosure button rather than a destination, and the
    // two pages under it stay out of the tree until it is opened.
    await expect(
      page.getByRole("navigation").getByRole("list").getByRole("link"),
    ).toHaveCount(5);
  });

  test("the use-cases disclosure reveals its pages", async ({ page }) => {
    await page.goto("/");
    const nav = page.getByRole("navigation");
    const useCases = nav.getByRole("button", { name: "Use-cases" });
    await expect(useCases).toHaveAttribute("aria-expanded", "false");

    await useCases.click();
    await expect(useCases).toHaveAttribute("aria-expanded", "true");
    // Scoped to the navigation and exact: the FAQ links out to both of these
    // pages, so an unscoped name matches body copy too.
    await expect(
      nav.getByRole("link", { name: "Clinical", exact: true }),
    ).toBeVisible();
    await expect(
      nav.getByRole("link", { name: "Research", exact: true }),
    ).toBeVisible();

    // A group left open would cover the page below it. `.first()` because the
    // dev toolbar the tests run against contributes headings of its own.
    await page.locator("h1").first().click();
    await expect(useCases).toHaveAttribute("aria-expanded", "false");
  });
});

test.describe("mobile", { tag: "@mobile" }, () => {
  test.skip(({ isMobile }) => !isMobile);

  test("page fits the viewport without zooming out", async ({ page }) => {
    await page.goto("/");

    // Decorative background SVGs overflow the viewport on purpose. If that
    // overflow ever becomes scrollable again, mobile browsers zoom out to
    // fit the whole document and the site renders tiny.
    const metrics = await page.evaluate(() => ({
      scale: window.visualViewport?.scale ?? 1,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(metrics.scale).toBeGreaterThan(0.99);
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
  });

  test("navigation is available", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("navigation")).not.toBeVisible();
    const menuButton = page.getByRole("button", { name: /menu/ });
    await expect(menuButton).toBeVisible();

    await menuButton.click();
    await expect(page.getByRole("navigation")).toBeVisible();
    await expect(
      page.getByRole("navigation").getByRole("list").getByRole("link"),
    ).toHaveCount(5);

    await menuButton.click();
    await expect(page.getByRole("navigation")).not.toBeVisible();
  });
});

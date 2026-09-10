import { test, expect } from "@playwright/test";

// The pricing controls only ever restate figures the page already carries, so
// what can go wrong is the two halves disagreeing about which figure.

test.describe("desktop", { tag: "@desktop" }, () => {
  test.skip(({ isMobile }) => isMobile);

  test("the volume select and the price beside it agree", async ({ page }) => {
    await page.goto("/use-cases/research");

    const card = page.locator(".package").filter({ hasText: "Core" });
    const select = card.locator(".volume select");
    const amount = card.locator(".price .amount");

    await select.selectOption("400");
    await expect(amount).toHaveText("7 500");

    // A back-navigation can restore the select, which the server could not
    // have known about when it rendered the figure beside it. Whether it does
    // is the browser's business; that the two agree afterwards is ours, so
    // this reads the restored volume rather than assuming one.
    await page.goto("/publications");
    await page.goBack();

    const restored = await select.inputValue();
    const expected = await select
      .locator(`option[value="${restored}"]`)
      .getAttribute("data-academic");

    await expect(amount).toHaveText(expected!);
    await expect(card.locator("a.cta")).toHaveAttribute(
      "href",
      new RegExp(`slides=${restored}`),
    );
  });
});

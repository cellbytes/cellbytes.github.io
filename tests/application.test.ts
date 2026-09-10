import { test, expect, type Page } from "@playwright/test";

// The application scroller animates on the .scroller element's view
// timeline: progress is 0 when the scroller's top reaches the top of the
// viewport and 1 when its bottom reaches the bottom. These offsets mirror
// the constants in ApplicationScroller.astro: slide index i crossfades in
// between (3 + 9.3 * i)% and (6 + 9.3 * i)%, and on narrow layouts its
// card fades out between (10 + 9.3 * i)% and (11 + 9.3 * i)%.

async function scrollToProgress(page: Page, progress: number) {
  await page.evaluate((p) => {
    const scroller = document.querySelector(".scroller");
    if (!scroller) throw new Error(".scroller not found");
    const rect = scroller.getBoundingClientRect();
    const top = rect.top + window.scrollY;
    window.scrollTo(0, top + (rect.height - window.innerHeight) * p);
  }, progress);
}

const image = (page: Page, name: string) =>
  page.locator(`.scroller img.${name}`);
const card = (page: Page, name: string) =>
  page.locator(`.scroller .card.${name}`);

test.beforeEach(async ({ page }) => {
  await page.goto("/application");
});

test("screenshots crossfade in as the page scrolls", async ({ page }) => {
  await scrollToProgress(page, 0);
  await expect(image(page, "base")).toHaveCSS("opacity", "1");
  await expect(image(page, "triage")).toHaveCSS("opacity", "0");
  await expect(image(page, "report")).toHaveCSS("opacity", "0");

  // At 50% the sixth slide (45.3%-48.3%) is fully in and the seventh
  // (53.7%-56.7%) has not started.
  await scrollToProgress(page, 0.5);
  await expect(image(page, "mask-visualization")).toHaveCSS("opacity", "1");
  await expect(image(page, "cell-differential")).toHaveCSS("opacity", "0");

  await scrollToProgress(page, 1);
  await expect(image(page, "report")).toHaveCSS("opacity", "1");
});

test.describe("desktop", { tag: "@desktop" }, () => {
  test.skip(({ isMobile }) => isMobile);

  test("cards stay visible while scrolling", async ({ page }) => {
    await scrollToProgress(page, 0.5);
    await expect(card(page, "scarcity-cellularity")).toHaveCSS("opacity", "1");
    await expect(card(page, "mask-visualization")).toHaveCSS("opacity", "1");
  });
});

test.describe("mobile", { tag: "@mobile" }, () => {
  test.skip(({ isMobile }) => !isMobile);

  test("passed cards fade out to make room for the next", async ({ page }) => {
    // At 50% the fifth card (hidden from 43.8%) is gone and the sixth
    // (hidden from 52.3%) is still showing.
    await scrollToProgress(page, 0.5);
    await expect(card(page, "scarcity-cellularity")).toHaveCSS("opacity", "0");
    await expect(card(page, "mask-visualization")).toHaveCSS("opacity", "1");
  });
});

test("the polyfill drives the scroller when native support is missing", async ({
  page,
}) => {
  // Only meaningful without native support: with it the polyfill is not
  // loaded, and forcing it to load anyway just makes it fight the native
  // engine, a state that cannot occur in production. As of writing this
  // runs on the firefox project.
  const nativeSupport = await page.evaluate(() =>
    CSS.supports("animation-timeline: --works"),
  );
  test.skip(nativeSupport, "scroll-driven animations supported natively");

  const polyfillRequest = page.waitForRequest(/scroll-timeline/);
  await page.reload();
  await polyfillRequest;

  await scrollToProgress(page, 0.5);
  await expect(image(page, "mask-visualization")).toHaveCSS("opacity", "1");
  await expect(image(page, "cell-differential")).toHaveCSS("opacity", "0");

  await scrollToProgress(page, 1);
  await expect(image(page, "report")).toHaveCSS("opacity", "1");

  // The narrow layout adds the card fade-outs on the same timeline.
  await page.setViewportSize({ width: 390, height: 844 });
  await scrollToProgress(page, 0.5);
  await expect(card(page, "scarcity-cellularity")).toHaveCSS("opacity", "0");
  await expect(card(page, "mask-visualization")).toHaveCSS("opacity", "1");
});

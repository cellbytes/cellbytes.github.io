import { test, expect } from "@playwright/test";
import { routedPaths } from "~src/utils/routes";

// What the head asks the browser to fetch early. Both checks here guard a
// largest-paint regression that looks like nothing from the page itself: the
// page still renders, just a round trip later than it needs to.

test.describe("desktop", { tag: "@desktop" }, () => {
  // The head is identical on every viewport, so check it once.
  test.skip(({ isMobile }) => isMobile);

  for (const path of routedPaths()) {
    test(`${path} preloads the webfont`, async ({ page }) => {
      await page.goto(path);

      const preload = page.locator(
        'link[rel="preload"][as="font"][href="/lato.woff2"]',
      );
      await expect(preload).toHaveCount(1);

      // Fonts are fetched anonymously even same-origin, so a preload without
      // `crossorigin` is a second request the font never uses. It is worse
      // than no preload: the bytes are fetched twice and neither one is early.
      await expect(preload).toHaveAttribute("crossorigin", /.*/);
    });
  }

  test("the front page preloads the hero poster", async ({ page, request }) => {
    await page.goto("/");

    const poster = await page.locator("#demo-video").getAttribute("poster");
    expect(poster, "the hero video has no poster").toBeTruthy();

    // The poster is what the page paints first and holds until the stream has
    // buffered. The browser does not find it until it reaches the video, which
    // is late for the element that decides the largest paint.
    await expect(
      page.locator(`link[rel="preload"][as="image"][href="${poster}"]`),
    ).toHaveCount(1);

    // Served out of the image pipeline rather than straight from public/,
    // which is what encodes and sizes it. Checked by the bytes: the dev server
    // and the build disagree on both the URL and the content type, but an AVIF
    // is an AVIF, and the format is the whole point of routing it through the
    // pipeline. The brand sits in the ISO-BMFF `ftyp` box at the head of it.
    const response = await request.get(poster!);
    expect(response.status()).toBe(200);
    const bytes = await response.body();
    expect(bytes.subarray(4, 12).toString("latin1")).toBe("ftypavif");
  });
});

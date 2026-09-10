import { test, expect } from "@playwright/test";
import { routedPaths } from "~src/utils/routes";
import { CONTACT_TOPICS, contactMessage } from "~src/utils/contactTopics";

// Each link into the form carries the topic of the page it leaves, and the
// form opens on that topic's draft. `contactHref` type-checks the topic
// wherever an .astro file calls it, so what is left to check is the two ends
// it cannot see: a topic written by hand into markdown, and the script that
// has to find the box and fill it.

test.describe("desktop", { tag: "@desktop" }, () => {
  // Nothing here varies by viewport.
  test.skip(({ isMobile }) => isMobile);

  test("every contact link names a topic that exists", async ({ page }) => {
    const offenders: string[] = [];

    for (const path of routedPaths()) {
      await page.goto(path);
      const hrefs = await page
        .locator('a[href*="/contact"]')
        .evaluateAll((links) =>
          links.map((link) => link.getAttribute("href") ?? ""),
        );

      for (const href of hrefs) {
        const topic = new URL(href, page.url()).searchParams.get("topic");
        // A link with no topic is the neutral entry, which the navbar uses.
        if (topic && !(topic in CONTACT_TOPICS)) {
          offenders.push(`${path} -> ${href}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  for (const topic of Object.keys(CONTACT_TOPICS)) {
    test(`?topic=${topic} opens the form on its draft`, async ({ page }) => {
      const query = `topic=${topic}`;
      await page.goto(`/contact?${query}`);
      await expect(page.locator("#message")).toHaveValue(
        contactMessage(new URLSearchParams(query))!,
      );
    });
  }

  // The drafts are written as fragments joined across lines, so a fumbled
  // join reads as prose in the source and ships a defect nobody sees.
  test("every draft reads as one clean line of prose", () => {
    for (const topic of Object.keys(CONTACT_TOPICS)) {
      const draft = contactMessage(new URLSearchParams({ topic }))!;
      expect(draft, `${topic} has a doubled or edge space`).toBe(
        draft.trim().replace(/\s+/g, " "),
      );
      expect(draft, `${topic} runs two words together`).not.toMatch(
        /[a-z],?[A-Z]/,
      );
      // The site is ASCII-only, and satori cannot draw what Lato lacks.
      expect(draft, `${topic} carries a non-ASCII character`).toMatch(
        /^[\x20-\x7E]+$/,
      );
    }
  });

  test("an unknown or absent topic leaves the box empty", async ({ page }) => {
    await page.goto("/contact");
    await expect(page.locator("#message")).toHaveValue("");

    // A retired topic must not strand the visitor with someone else's draft.
    await page.goto("/contact?topic=no-such-topic");
    await expect(page.locator("#message")).toHaveValue("");
  });

  // The one draft that names a figure rather than only a topic. A message
  // quoting a volume the reader never chose is worse than one quoting none.
  test("the Core draft names the volume the link carries", async ({ page }) => {
    // Asserted on the value rather than the text: the box is filled by script,
    // which leaves the textarea's own content empty.
    await page.goto("/contact?topic=research-core&slides=400");
    await expect(page.locator("#message")).toHaveValue(/for up to 400 slides/);

    for (const query of ["", "&slides=", "&slides=lots", "&slides=0"]) {
      await page.goto(`/contact?topic=research-core${query}`);
      await expect(page.locator("#message")).not.toHaveValue(/for up to/);
      await expect(page.locator("#message")).toHaveValue(
        /order the Core research package\./,
      );
    }
  });

  // The research drafts name the rate the cards were showing, which is a
  // choice the reader makes on the page rather than a property of the link.
  test("the audience toggle names the rate in every research draft", async ({
    page,
  }) => {
    await page.goto("/contact?topic=research-light&audience=academic");
    await expect(page.locator("#message")).toHaveValue(/for academic use/);

    await page.goto("/contact?topic=research-custom&audience=industrial");
    await expect(page.locator("#message")).toHaveValue(/for industrial use/);

    // An audience nobody picked is left unsaid rather than guessed at.
    for (const query of ["", "&audience=", "&audience=charitable"]) {
      await page.goto(`/contact?topic=research-advanced${query}`);
      await expect(page.locator("#message")).not.toHaveValue(
        /for (academic|industrial) use/,
      );
      await expect(page.locator("#message")).toHaveValue(/larger cohort\./);
    }
  });

  test("both controls retarget the research links", async ({ page }) => {
    await page.goto("/use-cases/research");

    const links = page.locator('a[href^="/contact?"]');
    const card = page.locator(".package").filter({ hasText: "Core" });
    const order = card.locator("a.cta");

    // Every tier plus the custom offer, and nothing else on the page.
    await expect(links).toHaveCount(4);

    // The build emits the rate and the volume step the cards show at rest.
    for (const href of await links.evaluateAll((ls) =>
      ls.map((l) => l.getAttribute("href") ?? ""),
    )) {
      expect(href).toMatch(/audience=academic/);
    }
    await expect(order).toHaveAttribute("href", /slides=1000/);

    await page.getByRole("button", { name: "Industrial" }).click();
    for (const href of await links.evaluateAll((ls) =>
      ls.map((l) => l.getAttribute("href") ?? ""),
    )) {
      expect(href).toMatch(/audience=industrial/);
    }

    await card.locator(".volume select").selectOption("400");
    await expect(order).toHaveAttribute("href", /slides=400/);
    // The volume is the Core card's alone, so it must not leak to the others.
    await expect(
      page.locator('a[href*="topic=research-light"]'),
    ).not.toHaveAttribute("href", /slides=/);

    await order.click();
    await expect(page.locator("#message")).toHaveValue(
      /for up to 400 slides, for industrial use\./,
    );
  });
});

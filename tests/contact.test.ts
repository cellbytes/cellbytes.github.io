import { readFile } from "node:fs/promises";
import { test, expect } from "@playwright/test";
import { routedPaths } from "~src/utils/routes";
import { CONTACT_TOPICS, contactMessage } from "~src/utils/contactTopics";

// Each link into the form carries the topic of the page it leaves, and the
// form opens on that topic's draft. `contactHref` type-checks the topic
// wherever an .astro file calls it, so what is left to check is the two ends
// it cannot see: a topic written by hand into markdown, and the script that
// has to find the box and fill it.
//
// The drafts are grouped into few tests on purpose. Every test costs a browser
// context on each project, and the suite runs close to the job's time limit.

const SITE = "https://cellbytes.io";

// Read from dist rather than the dev server: the links are static, so a build
// is enough to see them, and walking every page in a browser five times over
// is minutes of the budget for something no browser can disagree about.
test("every contact link names a topic that exists", async () => {
  const offenders: string[] = [];

  for (const path of routedPaths()) {
    const file = path === "/" ? "dist/index.html" : `dist${path}.html`;
    const html = await readFile(file, "utf8").catch(() => {
      throw new Error(`${file} is missing. Run \`npm run build\` first.`);
    });

    for (const match of html.matchAll(/href="([^"]*\/contact\?[^"]*)"/g)) {
      // Hrefs are HTML, so the query separator arrives escaped.
      const href = match[1]!.replaceAll("&amp;", "&");
      const topic = new URL(href, SITE).searchParams.get("topic");
      // A link with no topic is the neutral entry, which the navbar uses.
      if (topic && !(topic in CONTACT_TOPICS)) {
        offenders.push(`${path} -> ${href}`);
      }
    }
  }

  expect(offenders).toEqual([]);
});

// The drafts are written as fragments joined across lines, so a fumbled join
// reads as prose in the source and ships a defect nobody sees. No browser
// needed, so this asks for no page.
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

test.describe("desktop", { tag: "@desktop" }, () => {
  // The form is the same on every viewport, so fill it once.
  test.skip(({ isMobile }) => isMobile);

  test("each topic opens the form on its own draft", async ({ page }) => {
    for (const topic of Object.keys(CONTACT_TOPICS)) {
      const query = `topic=${topic}`;
      await page.goto(`/contact?${query}`);
      await expect(page.locator("#message")).toHaveValue(
        contactMessage(new URLSearchParams(query))!,
      );
    }
  });

  // What the link carries besides the topic: the volume the Core card was set
  // to and the rate the cards were pricing at. A draft quoting either one the
  // reader never chose is worse than one quoting none, so anything unusable
  // is left unsaid instead.
  test("the query's choices reach the draft, or nothing does", async ({
    page,
  }) => {
    const message = page.locator("#message");

    await page.goto("/contact?topic=research-core&slides=400");
    await expect(message).toHaveValue(/for up to 400 slides/);

    await page.goto("/contact?topic=research-light&audience=academic");
    await expect(message).toHaveValue(/for academic use/);

    await page.goto("/contact?topic=research-custom&audience=industrial");
    await expect(message).toHaveValue(/for industrial use/);

    for (const query of ["", "&slides=", "&slides=lots", "&slides=0"]) {
      await page.goto(`/contact?topic=research-core${query}`);
      await expect(message).not.toHaveValue(/for up to/);
    }

    for (const query of ["", "&audience=", "&audience=charitable"]) {
      await page.goto(`/contact?topic=research-advanced${query}`);
      await expect(message).not.toHaveValue(/for (academic|industrial) use/);
    }

    // An absent or retired topic must not strand the visitor with someone
    // else's draft.
    for (const query of ["", "?topic=no-such-topic"]) {
      await page.goto(`/contact${query}`);
      await expect(message).toHaveValue("");
    }
  });

  test("both research controls retarget the order links", async ({ page }) => {
    await page.goto("/use-cases/research");

    const links = page.locator('a[href^="/contact?"]');
    const card = page.locator(".package").filter({ hasText: "Core" });
    const order = card.locator("a.cta");
    const hrefs = () =>
      links.evaluateAll((ls) => ls.map((l) => l.getAttribute("href") ?? ""));

    // Every tier plus the custom offer, and nothing else on the page.
    await expect(links).toHaveCount(4);

    // The build emits the rate and the volume step the cards show at rest.
    expect(await hrefs()).toEqual(
      Array(4).fill(expect.stringContaining("audience=academic")),
    );
    await expect(order).toHaveAttribute("href", /slides=1000/);

    await page.getByRole("button", { name: "Industrial" }).click();
    expect(await hrefs()).toEqual(
      Array(4).fill(expect.stringContaining("audience=industrial")),
    );

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

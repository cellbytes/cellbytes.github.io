# Agent guidelines

Development guide for coding agents working on the Cellbytes web home page.
For what this site is, read [README.md](README.md) first; this file only covers
how to develop on it.

## What this repo is, in one line

The public marketing/home page for the Cellbytes application, built with Astro
and deployed via GitHub Pages (`cellbytes.github.io`), which serves it under the
custom domain `cellbytes.io` and redirects the github.io URLs there. That domain
is configured in the repository's Pages settings, not by a `CNAME` file in the
tree, and `site` in `astro.config.mjs` names it so generated absolute URLs point
at the origin visitors actually reach.

## Toolchain

- Node; npm for dependencies (`package-lock.json`).
- Framework: Astro (`astro.config.mjs`), with the MDX integration for news
  posts; content/components under `src/`, static assets under `public/`.
- Lint: ESLint (`eslint.config.js`, with the Astro, jsx-a11y, and Playwright
  plugins). Format: Prettier (`.prettierrc.mjs`, `prettier-plugin-astro`).
- Tests: Playwright (`playwright.config.ts`, specs under `tests/`).
- Video playback uses `hls.js`.

## Language server for coding agents

Coding agents get astro-ls diagnostics and navigation in-session, from a Claude
Code plugin this repo carries under `.claude/`. It covers `.astro` and `.ts`
alike, so the whole repo is served by the same checker `astro check` uses.

There is no devcontainer here to register it on create, so opening this repo on
its own means running these once by hand:

```sh
claude plugin marketplace add <repo root>/.claude
claude plugin install astro-lsp@cellbytes-cellbytes.github.io
```

Inside the unified dev-env container the `app` repo's plugins are the ones
loaded, and its `astro-lsp` finds this repo's server for `.astro` files; `.ts`
there goes to tsgo instead, since an extension can only belong to one server.

`.claude/lsp/astro-launcher.py` is a vendored copy owned by the `dev-env` repo -
read its README for what the launcher does and why astro-ls needs one. Change it
there and re-run that repo's `make sync-lsp-plugins`; do not edit the copy here.

## Common commands

| Command                  | Purpose                                              |
| ------------------------ | ---------------------------------------------------- |
| `npm install`            | Install dependencies.                                |
| `npm run dev`            | Start the Astro dev server (`--host`).               |
| `npm run build`          | `astro check` (type/diagnostics) then `astro build`. |
| `npm run preview`        | Serve the production build locally.                  |
| `npm test`               | Run the Playwright suite.                            |
| `npm run test:smoke`     | Run the home-page smoke test only.                   |
| `npx eslint .`           | Lint.                                                |
| `npx prettier --write .` | Format.                                              |

There is no `lint`/`format` npm script; invoke `eslint` and `prettier` directly
as above.

## Conventions

- Only use ASCII characters in code and comments. No em-dashes, en-dashes,
  unicode arrows, or other special characters.
- Keep components in Astro idiom; reach for client-side JS only where needed.

### URLs have no trailing slash

Every page is served at exactly one address: no `.html`, no trailing slash,
`/company` and `/news/<slug>`. That shape is what `build.format: "file"` in
`astro.config.mjs` buys. GitHub Pages resolves `/company` straight to
`company.html`, where a directory build leaves it nothing to match on the
unslashed path and answers with a 301 to `/company/`, so every internal click
and every crawl of an internal link pays for a redirect. `trailingSlash: "never"`
only makes the dev server agree; in production the host decides.

The cost is that `Astro.url.pathname` is the output file's path during a build
(`/company.html`, `/index.html`), not the URL a visitor sees. Anything naming a
page to the outside world - the canonical link, `og:url`, a sharing card's
address - goes through `canonicalPath` in `src/utils/url.ts`. Using
`Astro.url` directly ships `.html` into the head, which is a second URL for the
same page as far as an indexer is concerned.

Write internal links without the slash. `tests/urls.test.ts` walks every page
and fails on a link that carries one or that does not resolve directly, since
the redirect it causes is invisible from the page itself.

Retiring a URL is not an option: it was published, and GitHub Pages has no 301
to configure. Add the old path to `redirects` in `astro.config.mjs` instead,
which emits a stub carrying a canonical link to the new address, a meta refresh,
and `noindex`.

The slashed form of every page is a URL the site once published too, from when
it built to directories, so `src/pages/[...path]/index.html.ts` emits the same
kind of stub at `<page>/index.html`. `redirects` cannot express that: it
normalizes a slashed key to the unslashed route and emits the stub _as_ that
page, quietly replacing the real one. Serving both shapes is not a conflict,
because GitHub Pages tries `<path>.html` before it considers a directory of the
same name - which is why `/news` reaches the listing and not the stub, even
though `news/` exists.

### The navigation is a flat list with one group

`links` in `Navbar.astro` is the whole main navigation. An entry carrying
`children` instead of an `href` is a disclosure rather than a destination: it
renders as a button that reveals its pages, because the group has no page of
its own to link to. Giving it an `href` would advertise a URL the site does not
route.

The group's pages are hidden until it is opened, so a test counting navigation
links counts the top-level entries only. The mobile menu overlays the page
using a negative margin sized from `--links`, which is why an open group adds
`--sublinks` to that count rather than pushing the page down.

### What crawlers are told

`public/robots.txt` allows everything and points at the sitemap. Read the file
before adding a per-agent rule: the retrieval crawlers behind generated answers
are different user agents from the training ones, and blocking the wrong half of
that pair removes the site from the answers rather than from the training set.

`@astrojs/sitemap` builds `/sitemap-index.xml` from the routes, minus the
redirect stubs, which are `noindex` and exist only to forward a retired URL.

`src/pages/rss.xml.ts` publishes the news posts as a feed, advertised from every
page's head. It sets `trailingSlash: false`, since the package would otherwise
link every item at the one URL shape the site does not serve as canonical, and a
reader stores that link as the post's identity.

Each entry's `lastmod` is the commit date of the file the page is built from,
via `gitModifiedDate` in `src/utils/gitDate.ts`. Frontmatter records only when a
post was published, so a post edited a year later would otherwise still look
untouched, and nothing would re-read it. Asking git means there is no date for
an author to remember to bump and none that can disagree with the commit that
changed the prose.

That makes history a build input: `.github/workflows/deploy.yml` checks out with
`fetch-depth: 0`, and a shallow checkout builds a sitemap with no dates at all
rather than failing. `tests/sitemap.test.ts` is what catches that, by reading
`dist/` - so it needs a build, which the workflow runs before the suite.

`src/utils/routes.ts` is what enumerates the site for all of this. It reads the
filesystem, so it belongs to the build; it also cannot use the `~src` alias,
because `astro.config.mjs` loads it before Vite resolves one.

### Structured data

`src/utils/structuredData.ts` builds one `@graph` per page, emitted by
`Layout`. The organization and the site are on every page; a page passes what
it is on top of that as `jsonLd`.

None of it is required to appear in a generated answer - those read the
ordinary index, and no markup unlocks them. What it buys is rich results and
one identity: "Cellbytes" is a coined compound, so nothing outside this site can
infer that the company here, the one on LinkedIn and the one in a partner's
announcement are the same thing. A stable `@id` plus `sameAs` says it once.

The rule for adding to it: every value must be a fact the page already states.
Structured data asserting something the page does not is worse than none,
because it is a claim nobody can check against the page it sits on. That is why
the product node carries no `offers` and a post gets no `dateModified` when git
cannot answer. `tests/structuredData.test.ts` holds the graph to the page it
sits on, comparing its dates and URLs against the head rather than against a
copy of the same values.

An article's dates come from `ArticleMeta`, which the post page fills from
frontmatter (published) and git (modified), and which `Layout` also emits as the
`article:*` OpenGraph properties. Both sides read one value, so they cannot
disagree.

### News posts are folders

Every post is a folder holding the post and everything it uses:

```txt
src/content/news/<slug>/
  index.md     (or index.mdx)
  hero.jpg
  ...whatever else that post needs
```

The hero is always `hero.<ext>`, referenced from frontmatter as `./hero.jpg`.
Naming it after the post instead only invites the two to drift apart, and
nothing outside the folder ever refers to it.

The folder is what keeps a post's assets attached to it: they move when it
moves, and a rename cannot orphan them in a shared directory. It costs nothing
for a post with only a hero, so there is no threshold to argue about and no
second shape to support.

The loader's `generateId` (`src/content.config.ts`) drops the trailing `/index`,
so a post at `<slug>/index.md` still serves `/news/<slug>` and the folder never
shows up in a URL. Anything walking the posts by filename has to strip it too;
`tests/opengraph.test.ts` does.

Use `.md` unless the post needs to import something, which is the one thing
`.mdx` buys.

An `.mdx` post can `import` components and its own colocated files, with Vite
content-hashing whatever it imports. A screen recording goes through
`PostVideo`:

```mdx
import PostVideo from "~src/components/PostVideo.astro";
import demo from "./demo.mp4?url";
import demoPoster from "./demo-poster.jpg";

<PostVideo
  src={demo}
  poster={demoPoster}
  caption="What the recording shows, in a sentence."
/>
```

Note the two different import forms. The video takes `?url`, because nothing
reads inside it. The poster must NOT: a plain image import returns Astro's
`ImageMetadata`, whose width and height reserve the box before anything loads.
A poster cut from the recording carries the recording's shape, so no dimension
has to be written down or kept in sync by hand. `PostVideo` accepts `width` and
`height` only for a poster that is not the recording's shape, which would
otherwise letterbox rather than crop.

Cut the poster at an exact fraction of the recording (`scale=1280:676` for a
2560x1352 capture) rather than with `-2` height rounding, which lands on an even
number and skews the ratio by a fraction of a percent.

Recordings are silent and carry no `<track>`; the caption and the prose around
it are the text alternative. See the component for why it does not autoplay.

Prefer remuxing a screen capture over re-encoding it. OBS output is usually
already efficient, so `-c:v copy -an -movflags +faststart` gives a smaller file
at full resolution with no generation loss; re-encoding is worth it only once a
probe shows the capture is genuinely too big. Trimming survives a stream copy
via an MP4 edit list, except that a cut can only start where a keyframe already
is.

### Images in a post can carry a caption

An image alone in a paragraph renders as a `<figure>`, captioned by the line
under it:

```md
![What the image shows, for a reader who cannot see it](./photo.jpg)
Adapted from figure 1 of Luukkainen[^1].
```

The caption is ordinary markdown by the time it is read, so a footnote
reference in one is a real reference: numbered with the rest of them, and
linked back to from the definition at the foot of the post.

An image's title captions it too, for a caption with no markup in it:

```md
![What the image shows](./photo.jpg "Adapted from figure 1.")
```

A title is plain text by definition, so nothing written there can be a link,
emphasis or a footnote reference; `[^1]` in a title stays four characters. Use
the line below the image whenever the caption needs any of that.

`alt` and the caption are not the same sentence. The caption is prose for
everyone; `alt` describes the picture to whoever is not seeing it, so a caption
repeated verbatim into `alt` says nothing new.

`titleFigure` in `src/utils/titleFigure.ts` does the rewriting, registered on
the Markdown processor in `astro.config.mjs`. It converts only a paragraph that
starts with the image, and only across a line break, so an image inside a
sentence stays where it is. An image with neither caption stays an ordinary
`<img>`. Astro rewrites the `src` afterwards in every case, so the file is
still optimized and hashed.

The processor is Satteri, which does not run rehype plugins, hence a Satteri
plugin rather than something off the shelf. Astro's default is named explicitly
in `astro.config.mjs` for that reason, and `@astrojs/mdx` reads the same
setting, so a plugin added there covers `.md` and `.mdx` alike. Rendered posts
are cached under `.astro/`, which a change to a plugin does not invalidate:
delete it to see one take effect.

### Head metadata and OpenGraph cards

A page declares its own head metadata, in its own file, as an exported `meta`
that it spreads into the layout:

```astro
---
import Layout from "~src/layouts/Layout.astro";
import type { PageMeta } from "~src/utils/opengraph";
import hero from "~src/assets/images/example.jpg";

export const meta = {
  title: "Example | Cellbytes",
  description: "Shown in search results and on the sharing card.",
  card: { title: "A headline for the card", image: hero },
} satisfies PageMeta;
---

<Layout {...meta} />
```

`src/pages/og/[...slug].jpg.ts` renders one 1200x630 sharing card per page and
per news post. It finds the pages by globbing `src/pages` for that `meta` export
(or, for markdown pages, their frontmatter), so a new page gets a card with no
registration step and the card can never disagree with the head.

Nobody names a card's URL. `Layout` derives it from the page's own path with
`ogSlug` and the endpoint derives it from the page file's path, which is how the
two meet: `/application` gets `/og/application.jpg`, `/` gets `/og/index.jpg`.
`card` is optional throughout, so a page needs it only to override the headline
or supply a photo; without one the card falls back to the brand artwork.

Every routable page gets a card whether or not the walk can read metadata off
it, because `Layout` advertises one for every page unconditionally and a
crawler that 404s on the promised image drops the preview rather than falling
back. A page the walk cannot read declares no headline, so it gets the brand
card, the same one the front page uses. For the same reason the endpoint walks
news posts unfiltered: `news/[slug].astro` routes drafts too, so drafts need
cards too. They just have no accent, since accents are assigned to published
posts, which are the ones that sit next to each other in a listing.

That guarantee is the thing to preserve when adding a route. `pageRoute` in
`src/utils/routes.ts` decides what counts as routable, and `src/utils/routes.ts`
walks `src/pages` and `src/content/news` with it to enumerate what the site
serves. `tests/opengraph.test.ts` fails if any page it finds does not serve a
card; `tests/urls.test.ts` checks the same list for URL shape. A new _dynamic_ route is the
one case the walk cannot see: enumerate its entries in the endpoint the way
news posts are, or its pages will promise cards that do not exist.

Things worth knowing before editing `src/utils/opengraphCard.ts`:

- The cards are built at build time by satori (layout, text to outlines), resvg
  (rasterize) and sharp (crop the photo, encode the JPEG). Nothing runs in a
  browser, so this works on GitHub Pages without a runtime image service.
- Cards are JPEG, not PNG. Most of them are photographs, which PNG stores
  essentially whole: the set was 5.2 MB as PNG against 0.8 MB as JPEG, and the
  biggest card alone was over 1 MB. That is not only bytes, it is previews, as
  WhatsApp stops rendering one past a few hundred KB. The test bounds every
  card at 300 KB so a format change cannot quietly undo this. Encoding keeps
  full chroma resolution (`4:4:4`), since a card is mostly type and flat brand
  color and the usual subsampling smears exactly those edges.
- satori has no stylesheet, so the brand colors are duplicated as literals in
  `OG_COLORS`. Name each entry after the `theme.css` token that holds the hex;
  `tests/opengraph.test.ts` compares the two and fails on drift.
- satori cannot read `public/lato.woff2`: it takes ttf/otf/woff only, and that
  file is a 194-codepoint subset with no smart quotes or dashes, which post
  titles do use. The generator therefore uses the full static Lato in
  `src/assets/fonts/` (OFL, license alongside).
- There are two card layouts. The headline one is the default: photo behind a
  bottom-up scrim mirroring the post hero, or, with no photo, a light brand wash
  with the bytes and cells clusters down the right, clear of the text on the
  left. `card: { variant: "brand" }` picks the other, the logotype alone between
  the clusters on opposite corners, which the front page uses.
- For the cells, reach for `corner-detached` over `cluster-large`: the large
  cluster packs 70 blobs into its box, which shrinks to fizz beside the bytes
  rather than reading as their counterpart.
- Text on a cluster card is clamped to a narrower measure so it stays clear of
  the artwork. A photo card has a full-bleed scrim instead, so it runs the full
  width; clamping it too truncated the post descriptions.
- The logotype is drawn exactly as exported, colors included. Over a photo it
  gets a white chip to sit on, the way the site puts it on the white navbar,
  bordered like a framed hero image so the pill still reads against a white
  photo. Do not recolor the mark: its ring and its wordmark share one
  `fill="black"`, so repainting for contrast changes the mark itself.
- The accent tokens are pastels meant for the white page and disappear on a
  light card, so the rule above the headline switches to `--accent-1` there.
- Titles and descriptions are clamped (3 and 2 lines) and the title steps down
  in size as it gets longer, so overlong copy degrades instead of overflowing.

### Colors in SVG artwork

The asset files under `src/assets/` keep whatever literal colors their design
tool exported; nothing rewrites them. Instead each usage site tags the SVG with
an `art-*` class and `src/styles/artwork.css` repaints it from `theme.css`
tokens, so overriding a token retints the artwork with it.

Adding or moving artwork:

- Tag it: `<BytesCluster class="art-bytes-cluster ..." />`. Untagged assets keep
  their exported colors and silently ignore the theme, which
  `tests/artwork-colors.test.ts` fails on.
- Add its color map to `artwork.css` and the matching entry to the `ARTWORK`
  table in that test.

Things worth knowing before editing either file:

- Astro inlines imported SVGs into the page DOM. That is what lets a stylesheet
  reach inside them and custom properties inherit into them. `var()` is not
  substituted in an SVG presentation attribute, so `fill="var(--x)"` inside an
  asset would do nothing; a stylesheet declaration always works.
- Illustrator keys its colors on generic `.cls-1`, `.cls-2`, ... classes, which
  our SVGO pass in `astro.config.mjs` namespaces with a per-file content hash.
  The hash changes with the artwork, so selectors match on the suffix:
  `[class$="__cls-1"]`.
- `cls-N` is positional, not semantic: `cls-1` is magenta in one asset and pale
  blue in another, and a re-export can renumber it. The maps are therefore per
  asset, and `tests/artwork-colors.test.ts` asserts the rendered color of every
  tagged element so a re-export fails loudly instead of mistinting a page.
- To retint one instance, override the token on an ancestor
  (`--bytes-magenta: var(--bytes-light-magenta)`) rather than overwriting the
  asset's fills; see `.bytes-corner` in `src/pages/application.astro`.

Not covered: the cell artwork in `src/assets/backgrounds/cells/`, whose colors
are radial gradient stops rather than flat fills. Brand marks stay hardcoded on
purpose, since the partner logos are third-party trademarks and the logotype has
to match `public/favicon.svg`, which is loaded through `<link rel="icon">` and
cannot see the page's custom properties at all. `icons/logomark.svg` is that
same mark without the wordmark, for places that need the ring and pixels alone
(the hub of the formats diagram on `/use-cases/research`); it is the favicon's
art verbatim, so the three move together or not at all.

The mark's five pixel fills are also declared as `--logo-*` tokens in
`theme.css`, for elements that echo the mark rather than repaint it (the pixels
flowing out of it in `FormatFlow`). Nothing reads those tokens back into the
artwork, so they are a copy that has to be updated with it, not a source of
truth over it.

## Before finishing a change

Ensure the site builds clean, lints, and the smoke test passes:

```sh
npx prettier --check . && npx eslint . && npm run build && npm run test:smoke
```

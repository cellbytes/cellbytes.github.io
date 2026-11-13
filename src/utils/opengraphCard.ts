import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ImageMetadata } from "astro";
import { Resvg } from "@resvg/resvg-js";
import satori from "satori";
import sharp from "sharp";
import type { Accent } from "~src/consts";
import { imageFsPath } from "~src/utils/image";
import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from "~src/utils/opengraph";

/**
 * Builds the social sharing card for a page or news post at build time.
 *
 * satori lays the card out from the element tree below and emits an SVG with
 * the text already converted to outlines, resvg rasterizes that, and sharp
 * pre-crops the background photo and encodes the result as JPEG. All three run
 * in node only, so the cards drop straight into the static output with no
 * runtime image service.
 */

export interface OgCard {
  /** `"brand"` swaps the headline layout for the centered logotype. */
  variant?: "brand" | undefined;
  /** Headline, drawn large. Wraps over at most three lines. */
  title: string;
  /** Supporting line under the headline. Wraps over at most two lines. */
  description?: string | undefined;
  /** Small uppercase line above the headline, e.g. a publication date. */
  eyebrow?: string | undefined;
  /** Photo used full bleed behind a dark scrim. Omitted gives a light card. */
  image?: ImageMetadata | undefined;
  /** Color of the rule above the headline. */
  accent?: Accent | undefined;
}

/**
 * Colors the cards are painted in, mirroring the tokens of the same name in
 * `src/styles/theme.css`. satori has no stylesheet to read them from, so they
 * have to be literals here; `tests/opengraph.test.ts` asserts that every one
 * still matches theme.css so the cards cannot drift away from the site.
 */
const OG_COLORS = {
  "primary-1": "#0d083f",
  "accent-1": "#a24396",
  "background-1": "#e4eef4",
  "background-2": "#fdf5fb",
  "text-color-heading": "#130d56",
  // What --text-color-body resolves to. Named after the token holding the hex
  // so the drift check has something to compare against.
  "primary-2": "#484566",
  "bytes-purple": "#eed7f4",
  "bytes-blue": "#e4eef4",
  "bytes-mid-blue": "#d8e6f2",
  "support-purple": "#e2dbf6",
  "support-pink": "#ffeaf3",
} as const;

/** Card geometry, in the same px units satori lays out in. */
const PADDING = 60;
const LOGOTYPE_ASSET = "src/assets/icons/logotype.svg";
const LOGO_HEIGHT = 44;
// Intrinsic viewBox of src/assets/icons/logotype.svg, which satori needs to
// size the raster it gets handed.
const LOGO_ASPECT = 139 / 32;
const LOGO_WIDTH = Math.round(LOGO_HEIGHT * LOGO_ASPECT);
const ACCENT_RULE_WIDTH = 88;
const ACCENT_RULE_HEIGHT = 6;
// Measure for the headline and blurb on a card decorated with clusters, which
// hold its right edge. A photo card has a full-bleed scrim instead, so its text
// runs the full width between the padding and does not need clamping early.
const TEXT_WIDTH_BESIDE_CLUSTERS = 760;
// Breathing room around the mark inside its white chip on a photo card.
const LOGO_CHIP_PADDING_X = 26;
const LOGO_CHIP_PADDING_Y = 18;
// The mark on the brand card, which draws it as the subject rather than a tag.
const BRAND_LOGO_WIDTH = 620;
const BRAND_LOGO_HEIGHT = Math.round(BRAND_LOGO_WIDTH / LOGO_ASPECT);

/**
 * The clusters that decorate a card with no photo, with the aspect ratio of
 * each asset's viewBox so a drawn width implies its height.
 *
 * The cells are the detached corner rather than the large cluster: that one
 * packs 71 cells into its box, which reads as fizz next to the bytes instead of
 * as its counterpart. This one has 11, at a size that matches the squares.
 */
const BYTES_CLUSTER = {
  asset: "src/assets/backgrounds/bytes/cluster-large.svg",
  aspect: 759.998 / 592.53,
} as const;
const CELLS_CLUSTER = {
  asset: "src/assets/backgrounds/cells/corner-detached.svg",
  aspect: 193.921 / 236.111,
} as const;

/**
 * Where those clusters sit, per card. Both bleed past the edge on purpose, the
 * way they do on the page sections. With text down the left they keep to the
 * right of it; with nothing but the mark in the middle they take opposite
 * corners, as they do on the static brand card.
 */
const CLUSTER_PLACEMENT = {
  text: {
    bytes: { width: 460, top: -150, right: -60 },
    cells: { width: 300, bottom: -70, right: -40 },
  },
  brand: {
    bytes: { width: 520, top: -200, right: -100 },
    cells: { width: 340, bottom: 40, left: 70 },
  },
} as const;

interface Placement {
  width: number;
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
}

/**
 * Headline size by title length. Long titles step down so they still fit the
 * three lines they are clamped to instead of being cut off.
 */
function titleFontSize(title: string): number {
  if (title.length > 75) return 48;
  if (title.length > 45) return 56;
  return 64;
}

/**
 * satori takes a React element tree. The site has no React, so we hand it the
 * plain `{ type, props }` objects React elements are made of, which is all
 * satori actually reads.
 */
interface OgNode {
  type: string;
  props: Record<string, unknown>;
}

function el(type: string, props: Record<string, unknown>): OgNode {
  return { type, props };
}

const FONT_DIR = "src/assets/fonts";

// Astro always runs from the project root, so resolving build-time assets off
// cwd survives the SSR bundling that moves this module elsewhere on disk.
function projectPath(...segments: string[]): string {
  return path.join(process.cwd(), ...segments);
}

// The fonts and the logotype are the same for every card, so read and rasterize
// them once per build rather than once per page.
let fontsPromise: Promise<Awaited<ReturnType<typeof loadFonts>>> | undefined;

async function loadFonts() {
  const [regular, bold] = await Promise.all([
    readFile(projectPath(FONT_DIR, "Lato-Regular.ttf")),
    readFile(projectPath(FONT_DIR, "Lato-Bold.ttf")),
  ]);
  return [
    {
      name: "Lato",
      data: regular,
      weight: 400 as const,
      style: "normal" as const,
    },
    {
      name: "Lato",
      data: bold,
      weight: 700 as const,
      style: "normal" as const,
    },
  ];
}

function fonts() {
  fontsPromise ??= loadFonts();
  return fontsPromise;
}

const assetCache = new Map<string, Promise<string>>();

/**
 * An SVG asset as a PNG data URI, rasterized at twice its drawn width so it
 * stays crisp, and cached because every card draws the same few.
 *
 * Assets are drawn exactly as exported, colors included. The logotype in
 * particular must not be repainted for contrast: its ring and its wordmark
 * share one `fill="black"`, so recoloring changes the mark itself. On a photo
 * card it gets a white chip instead, the way the site puts it on the navbar.
 */
function svgAsset(relPath: string, drawnWidth: number): Promise<string> {
  const cacheKey = `${relPath}|${drawnWidth}`;
  const cached = assetCache.get(cacheKey);
  if (cached) return cached;

  const png = readFile(projectPath(relPath), "utf8").then((svg) => {
    const raster = new Resvg(svg, {
      fitTo: { mode: "width", value: drawnWidth * 2 },
    })
      .render()
      .asPng();
    return `data:image/png;base64,${raster.toString("base64")}`;
  });

  assetCache.set(cacheKey, png);
  return png;
}

/**
 * The post image cropped to the card, as a data URI for satori to embed. The
 * crop matches the `object-fit: cover` the page hero uses, and transparent
 * source images are flattened onto white like the hero's backdrop.
 *
 * Embedded lossless, even though the finished card is a JPEG: this copy only
 * has to survive being handed to the rasterizer, and compressing it here would
 * put the photo through two rounds of JPEG for no gain in the output.
 */
async function background(image: ImageMetadata): Promise<string | undefined> {
  const fsPath = imageFsPath(image);
  if (!fsPath) return undefined;

  const png = await sharp(fsPath)
    .resize(OG_IMAGE_WIDTH, OG_IMAGE_HEIGHT, {
      fit: "cover",
      position: "center",
    })
    .flatten({ background: "#ffffff" })
    .png({ compressionLevel: 3 })
    .toBuffer();

  return `data:image/png;base64,${png.toString("base64")}`;
}

/** One decorative cluster, absolutely placed and sized off its own aspect. */
async function clusterImage(
  art: { asset: string; aspect: number },
  place: Placement,
): Promise<OgNode> {
  const height = Math.round(place.width * art.aspect);
  return el("img", {
    src: await svgAsset(art.asset, place.width),
    width: place.width,
    height,
    style: {
      position: "absolute",
      width: place.width,
      height,
      ...(place.top !== undefined ? { top: place.top } : {}),
      ...(place.right !== undefined ? { right: place.right } : {}),
      ...(place.bottom !== undefined ? { bottom: place.bottom } : {}),
      ...(place.left !== undefined ? { left: place.left } : {}),
    },
  });
}

/** The brand wash every card without a photo is drawn on. */
const LIGHT_GROUND = {
  backgroundColor: OG_COLORS["background-1"],
  backgroundImage: `linear-gradient(135deg, ${OG_COLORS["background-2"]} 0%, ${OG_COLORS["background-1"]} 55%, ${OG_COLORS["support-purple"]} 100%)`,
} as const;

/**
 * The brand card: the mark alone, centered, framed by the clusters on opposite
 * corners. No headline, because the site name is the whole message and the
 * wordmark says it better than a line of type would. Any photo is ignored.
 */
async function brandCard(): Promise<OgNode> {
  const place = CLUSTER_PLACEMENT.brand;
  return el("div", {
    style: {
      position: "relative",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      width: OG_IMAGE_WIDTH,
      height: OG_IMAGE_HEIGHT,
      fontFamily: "Lato",
      ...LIGHT_GROUND,
    },
    children: [
      await clusterImage(BYTES_CLUSTER, place.bytes),
      await clusterImage(CELLS_CLUSTER, place.cells),
      el("img", {
        src: await svgAsset(LOGOTYPE_ASSET, BRAND_LOGO_WIDTH),
        width: BRAND_LOGO_WIDTH,
        height: BRAND_LOGO_HEIGHT,
        style: {
          position: "relative",
          width: BRAND_LOGO_WIDTH,
          height: BRAND_LOGO_HEIGHT,
        },
      }),
    ],
  });
}

/** The headline card: photo or clusters behind a mark, headline and blurb. */
async function headlineCard(card: OgCard): Promise<OgNode> {
  const photo = card.image ? await background(card.image) : undefined;
  const onDark = photo !== undefined;

  const children: OgNode[] = [];

  if (photo) {
    children.push(
      el("img", {
        src: photo,
        width: OG_IMAGE_WIDTH,
        height: OG_IMAGE_HEIGHT,
        style: {
          position: "absolute",
          top: 0,
          left: 0,
          width: OG_IMAGE_WIDTH,
          height: OG_IMAGE_HEIGHT,
          objectFit: "cover",
        },
      }),
      // Same bottom-up scrim as the post hero, darkened further because the
      // card carries a description as well as a headline and gets rendered at
      // thumbnail size in most feeds.
      el("div", {
        style: {
          position: "absolute",
          top: 0,
          left: 0,
          width: OG_IMAGE_WIDTH,
          height: OG_IMAGE_HEIGHT,
          backgroundImage: `linear-gradient(to top, rgba(13, 8, 63, 0.96) 0%, rgba(13, 8, 63, 0.85) 30%, rgba(13, 8, 63, 0.45) 56%, rgba(13, 8, 63, 0) 80%)`,
        },
      }),
    );
  } else {
    const place = CLUSTER_PLACEMENT.text;
    children.push(
      await clusterImage(BYTES_CLUSTER, place.bytes),
      await clusterImage(CELLS_CLUSTER, place.cells),
    );
  }

  // The accent tokens are pastels picked to sit on the white page, so they
  // vanish on a light card. There the rule takes the brand magenta instead.
  const ruleColor = onDark
    ? OG_COLORS[card.accent ?? "support-purple"]
    : OG_COLORS["accent-1"];

  const eyebrowRow: OgNode[] = [
    el("div", {
      style: {
        width: ACCENT_RULE_WIDTH,
        height: ACCENT_RULE_HEIGHT,
        borderRadius: ACCENT_RULE_HEIGHT / 2,
        backgroundColor: ruleColor,
      },
    }),
  ];

  if (card.eyebrow) {
    eyebrowRow.push(
      el("div", {
        style: {
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: 1.6,
          textTransform: "uppercase",
          color: onDark ? "rgba(255, 255, 255, 0.8)" : OG_COLORS["primary-2"],
        },
        children: card.eyebrow,
      }),
    );
  }

  const textBlock: OgNode[] = [
    el("div", {
      style: { display: "flex", alignItems: "center", gap: 20 },
      children: eyebrowRow,
    }),
    el("div", {
      style: {
        display: "block",
        fontSize: titleFontSize(card.title),
        fontWeight: 700,
        lineHeight: 1.1,
        letterSpacing: -0.5,
        color: onDark ? "#ffffff" : OG_COLORS["text-color-heading"],
        lineClamp: 3,
      },
      children: card.title,
    }),
  ];

  if (card.description) {
    textBlock.push(
      el("div", {
        style: {
          display: "block",
          fontSize: 26,
          lineHeight: 1.4,
          color: onDark ? "rgba(255, 255, 255, 0.85)" : OG_COLORS["primary-2"],
          lineClamp: 2,
        },
        children: card.description,
      }),
    );
  }

  children.push(
    el("div", {
      style: {
        position: "absolute",
        top: 0,
        left: 0,
        width: OG_IMAGE_WIDTH,
        height: OG_IMAGE_HEIGHT,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        // satori follows the CSS default of content-box, which would add the
        // padding to the card size and push the text block off the bottom.
        boxSizing: "border-box",
        padding: PADDING,
      },
      children: [
        // The mark keeps its exported colors, so over a photo it needs the
        // white backdrop it has on the navbar. The border is what the site uses
        // to frame a light hero image (see `.post-hero.framed`), and it is what
        // keeps the pill readable as a shape against a white photo.
        // `alignSelf` keeps the chip from stretching across the column.
        el("div", {
          style: {
            display: "flex",
            alignSelf: "flex-start",
            ...(onDark
              ? {
                  backgroundColor: "#ffffff",
                  padding: `${LOGO_CHIP_PADDING_Y}px ${LOGO_CHIP_PADDING_X}px`,
                  borderRadius: 999,
                  border: `2px solid ${OG_COLORS["bytes-mid-blue"]}`,
                }
              : {}),
          },
          children: [
            el("img", {
              src: await svgAsset(LOGOTYPE_ASSET, LOGO_WIDTH),
              width: LOGO_WIDTH,
              height: LOGO_HEIGHT,
              style: { width: LOGO_WIDTH, height: LOGO_HEIGHT },
            }),
          ],
        }),
        el("div", {
          style: {
            display: "flex",
            flexDirection: "column",
            gap: 18,
            ...(onDark ? {} : { maxWidth: TEXT_WIDTH_BESIDE_CLUSTERS }),
          },
          children: textBlock,
        }),
      ],
    }),
  );

  return el("div", {
    style: {
      position: "relative",
      display: "flex",
      width: OG_IMAGE_WIDTH,
      height: OG_IMAGE_HEIGHT,
      fontFamily: "Lato",
      // Without a photo the card falls back to the brand wash, the flat
      // counterpart of the gradient hero an imageless post gets.
      ...(onDark ? { backgroundColor: OG_COLORS["primary-1"] } : LIGHT_GROUND),
    },
    children,
  });
}

/** Renders `card` to a 1200x630 JPEG. */
export async function renderOgCard(card: OgCard): Promise<Buffer> {
  const root =
    card.variant === "brand" ? await brandCard() : await headlineCard(card);

  const svg = await satori(root, {
    width: OG_IMAGE_WIDTH,
    height: OG_IMAGE_HEIGHT,
    fonts: await fonts(),
  });

  const raster = new Resvg(svg, {
    fitTo: { mode: "width", value: OG_IMAGE_WIDTH },
  })
    .render()
    .asPng();

  // Full chroma resolution: a card is mostly type and flat brand color, and the
  // usual 4:2:0 subsampling smears exactly those edges. It costs a few KB on a
  // file that is already an order of magnitude smaller than the PNG.
  return sharp(raster)
    .jpeg({ quality: 82, mozjpeg: true, chromaSubsampling: "4:4:4" })
    .toBuffer();
}

// Builds the cell background graphics from the cell kit and the layouts.
//
//   npm run cells
//
// Reads art/cells/kit.svg (the shapes), art/cells/cells.json (white cells
// composed from them) and every art/cells/layouts/<name>.json, and writes
// src/assets/backgrounds/cells/<name>.svg. See "Cell artwork" in AGENTS.md for
// the formats and why the graphics are built this way.

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

const KIT = "art/cells/kit.svg";
const CELLS = "art/cells/cells.json";
const LAYOUTS = "art/cells/layouts";
const OUT = "src/assets/backgrounds/cells";

/**
 * Lighting is kept within this many degrees of straight down. Each distinct
 * angle costs one small gradient element per graphic, and a few degrees of
 * light direction is invisible at the size the cells are drawn.
 */
const LIGHT_STEP = 15;

/** The gradient each kind of shape is painted with, by id prefix. */
const GRADIENT_BY_PREFIX = { c: "gc", n: "gn", r: "gr" };

/**
 * Gradients whose highlight sits on the vertical centre line, so mirroring a
 * shape leaves its light where it was. A mirrored shape then needs only its
 * rotation undone, which lets it share a gradient with an unmirrored one.
 */
const SYMMETRIC = new Set(["gr"]);

/**
 * How far a nucleus moves inside its cell, as breathe.css animates it: squish
 * (fraction of size), tilt (degrees) and drift (fraction of the nucleus's
 * box). Keep these in step with the nucleus keyframes there; the build checks
 * every white cell against them, scaled by NUCLEUS_HEADROOM.
 */
const NUCLEUS_MOTION = { squish: 0.04, tilt: 4, drift: 0.03 };

/**
 * The build fails unless every nucleus stays inside its cytoplasm with motion
 * this much stronger than it is animated with, so a nucleus that comes close
 * to the edge is caught here rather than seen poking out on the page.
 */
const NUCLEUS_HEADROOM = 1.1;

/** Shortest decimal form of a number: 0.5 -> .5, -0.25 -> -.25. */
const num = (n) =>
  String(Math.round(n * 1000) / 1000)
    .replace(/^0\./, ".")
    .replace(/^-0\./, "-.");

/**
 * A placement `[id, x, y, scale?, rotation?, flip?]` as an affine matrix
 * `[a, b, c, d, e, f]` (SVG order). Rotation is in degrees; flip -1 mirrors
 * horizontally before rotating.
 */
function matrixOf([, x, y, s = 1, r = 0, f = 1]) {
  const t = (r * Math.PI) / 180;
  const cos = Math.cos(t);
  const sin = Math.sin(t);
  return [s * f * cos, s * f * sin, -s * sin, s * cos, x, y];
}

function multiply(m, n) {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}

/**
 * The transform attribute for a placement, in whichever of the readable form
 * and the plain matrix is shorter. Identity parts are omitted.
 */
function transformOf(placement) {
  const [, x, y, s = 1, r = 0, f = 1] = placement;
  let t = x || y ? `translate(${num(x)} ${num(y)})` : "";
  if (r !== 0) t += `rotate(${num(r)})`;
  if (f !== 1) t += `scale(${num(f * s)} ${num(s)})`;
  else if (s !== 1) t += `scale(${num(s)})`;
  const matrix = `matrix(${matrixOf(placement).map(num).join(" ")})`;
  if (matrix.length < t.length) t = matrix;
  return t ? ` transform="${t}"` : "";
}

/**
 * The gradient for a shape drawn with the world matrix `m`. Kit shapes are
 * lit from the top as drawn, and a rotated or mirrored shape would carry its
 * highlight round with it, so the gradient is counter-rotated (and mirrored
 * back) to keep the light where it is on every other cell.
 */
function lightFor(base, m, gradients) {
  let flip = m[0] * m[3] - m[1] * m[2] < 0;
  let angle = (Math.atan2(-m[2], m[3]) * 180) / Math.PI;
  if (flip && SYMMETRIC.has(base)) {
    // Mirror then rotate by a shows the light of a plain rotation by -a.
    flip = false;
    angle = -angle;
  }
  const step =
    (((Math.round(angle / LIGHT_STEP) * LIGHT_STEP) % 360) + 360) % 360;
  if (step === 0 && !flip) return base;
  const id = `${base}${step}${flip ? "f" : ""}`;
  if (!gradients.has(id)) {
    // Undo the rotation, then the mirroring, about the bounding box centre.
    const undo = flip
      ? `translate(1)scale(-1 1)rotate(${num(-step)} .5 .5)`
      : `rotate(${num(-step)} .5 .5)`;
    gradients.set(
      id,
      `<radialGradient id="${id}" href="#${base}" gradientTransform="${undo}"/>`,
    );
  }
  return id;
}

/**
 * The kit's parts: its style block, its base gradients by id and its shapes
 * by id. The kit is written in a fixed shape by the kit tooling, so plain
 * pattern matching is enough to take it apart.
 */
function readKit(path) {
  const svg = readFileSync(path, "utf8");
  const style = svg.match(/<style>([^<]*)<\/style>/)[1];
  const gradients = new Map(
    [
      ...svg.matchAll(
        /<radialGradient id="([\w-]+)"[\s\S]*?<\/radialGradient>/g,
      ),
    ].map((m) => [m[1], m[0]]),
  );
  const shapes = new Map(
    [...svg.matchAll(/<path id="([\w-]+)"[^>]*\/>/g)].map((m) => [m[1], m[0]]),
  );
  return { style, gradients, shapes };
}

/**
 * Points along a kit shape's outline. Kit paths use absolute M, relative c
 * and l, and z, which is all the kit tooling writes.
 */
function outline(d, steps = 12) {
  const tokens = d.match(/[MclzZ]|-?(?:\d*\.\d+|\d+\.?)(?:e[-+]?\d+)?/g);
  const points = [];
  let x = 0;
  let y = 0;
  let command = "";
  for (let i = 0; i < tokens.length;) {
    if (/[MclzZ]/.test(tokens[i])) command = tokens[i++];
    if (command === "z" || command === "Z") continue;
    const n = (k) => Number(tokens[i + k]);
    if (command === "M") {
      [x, y] = [n(0), n(1)];
      points.push([x, y]);
      i += 2;
      command = "l";
    } else if (command === "l") {
      [x, y] = [x + n(0), y + n(1)];
      points.push([x, y]);
      i += 2;
    } else if (command === "c") {
      const [x1, y1, x2, y2] = [x + n(0), y + n(1), x + n(2), y + n(3)];
      const [x3, y3] = [x + n(4), y + n(5)];
      for (let s = 1; s <= steps; s++) {
        const t = s / steps;
        const u = 1 - t;
        points.push([
          u * u * u * x +
            3 * u * u * t * x1 +
            3 * u * t * t * x2 +
            t * t * t * x3,
          u * u * u * y +
            3 * u * u * t * y1 +
            3 * u * t * t * y2 +
            t * t * t * y3,
        ]);
      }
      [x, y] = [x3, y3];
      i += 6;
    } else {
      throw new Error(`unexpected path command ${command} in the kit`);
    }
  }
  return points;
}

const apply = (m, [x, y]) => [
  m[0] * x + m[2] * y + m[4],
  m[1] * x + m[3] * y + m[5],
];

/** Even-odd point in polygon. */
function inside(polygon, [x, y]) {
  let hit = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      hit = !hit;
    }
  }
  return hit;
}

/**
 * The white cells whose nucleus would leave its cytoplasm somewhere in its
 * motion. The cell's own breathing moves cytoplasm and nucleus together, so
 * only the nucleus's own motion can push it out. That motion is tried at every
 * combination of five points along each of its three channels, since they
 * run out of step and can line up any way, about the centre of the nucleus's
 * box, as transform-box: fill-box does in the browser.
 */
function escapingNuclei(kit, cells) {
  const shapeOutline = new Map(
    [...kit.shapes].map(([id, path]) => [
      id,
      outline(path.match(/ d="([^"]+)"/)[1]),
    ]),
  );
  const placed = (part) =>
    shapeOutline.get(part[0]).map((p) => apply(matrixOf(part), p));
  const { squish, tilt, drift } = NUCLEUS_MOTION;
  const range = [-1, -0.5, 0, 0.5, 1].map((k) => k * NUCLEUS_HEADROOM);
  const escaping = [];
  for (const [id, parts] of Object.entries(cells)) {
    const cytoplasm = parts.filter(([p]) => p[0] === "c").flatMap(placed);
    const nucleus = parts.filter(([p]) => p[0] === "n").flatMap(placed);
    const xs = nucleus.map(([x]) => x);
    const ys = nucleus.map(([, y]) => y);
    const [cx, cy] = [
      (Math.min(...xs) + Math.max(...xs)) / 2,
      (Math.min(...ys) + Math.max(...ys)) / 2,
    ];
    const [w, h] = [
      Math.max(...xs) - Math.min(...xs),
      Math.max(...ys) - Math.min(...ys),
    ];
    const poses = range.flatMap((a) =>
      range.flatMap((b) => range.map((c) => [a, b, c])),
    );
    const escapes = poses.some(([a, b, c]) => {
      const [sx, sy] = [1 + a * squish, 1 - a * squish];
      const t = (b * tilt * Math.PI) / 180;
      const [dx, dy] = [c * drift * w, -c * drift * h];
      return nucleus.some(([x, y]) => {
        const [px, py] = [(x - cx) * sx, (y - cy) * sy];
        const point = [
          cx + dx + px * Math.cos(t) - py * Math.sin(t),
          cy + dy + px * Math.sin(t) + py * Math.cos(t),
        ];
        return !inside(cytoplasm, point);
      });
    });
    if (escapes) escaping.push(id);
  }
  return escaping;
}

/**
 * The graphic for one layout. Each placement is a <g> carrying its position,
 * around one animated child drawn about the origin: a red cell's <use>, or a
 * white cell's own <g> of cytoplasm and nucleus <use>s. The stylesheet
 * animates that child about its own centre, so a whole cell breathes as one
 * and the animation never replaces the placement.
 */
function buildGraphic(kit, cells, layout) {
  const shapes = new Set();
  const lights = new Map();
  const partUse = (part, world, local) => {
    const [id] = part;
    if (!kit.shapes.has(id)) throw new Error(`no shape ${id} in the kit`);
    shapes.add(id);
    const fill = lightFor(GRADIENT_BY_PREFIX[id[0]], world, lights);
    const transform = local ? transformOf(part) : "";
    return `<use href="#${id}"${transform} fill="url(#${fill})"/>`;
  };
  // A white cell's nuclei share one group, which the stylesheet moves inside
  // the cell, so all lobes move together. The multiply blend sits on that
  // group: an animated group may be composited on its own, and a blend set on
  // the shapes inside it would then no longer reach the cytoplasm below.
  const cellGroup = (parts, outer) => {
    const uses = (prefix) =>
      parts
        .filter(([id]) => id[0] === prefix)
        .map((p) => partUse(p, multiply(outer, matrixOf(p)), true))
        .join("");
    return `<g>${uses("c")}<g class="n">${uses("n")}</g></g>`;
  };
  const placements = layout.cells.map((placement) => {
    const outer = matrixOf(placement);
    const parts = cells[placement[0]];
    const inner = parts
      ? cellGroup(parts, outer)
      : partUse(placement, outer, false);
    return `<g${transformOf(placement)}>${inner}</g>`;
  });
  const bases = new Set(
    [...lights.values()].map((g) => g.match(/href="#(\w+)"/)[1]),
  );
  for (const id of shapes) bases.add(GRADIENT_BY_PREFIX[id[0]]);
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${layout.viewBox.map(num).join(" ")}">`,
    `<style>${kit.style}</style>`,
    `<defs>${[...bases]
      .sort()
      .map((b) => kit.gradients.get(b))
      .join("")}${[...lights.values()].join("")}${[...shapes]
      .sort()
      .map((s) => kit.shapes.get(s))
      .join("")}</defs>`,
    `<g style="isolation:isolate">`,
    ...placements,
    `</g>`,
    `</svg>`,
    "",
  ].join("\n");
}

const kit = readKit(KIT);
const cells = JSON.parse(readFileSync(CELLS, "utf8"));
const escaping = escapingNuclei(kit, cells);
if (escaping.length) {
  throw new Error(
    `nuclei would leave their cytoplasm in ${escaping.join(", ")}: move them ` +
      "inward in cells.json, or lower NUCLEUS_MOTION here and in breathe.css",
  );
}
for (const file of readdirSync(LAYOUTS).filter((f) => f.endsWith(".json"))) {
  const layout = JSON.parse(readFileSync(join(LAYOUTS, file), "utf8"));
  const out = join(OUT, `${basename(file, ".json")}.svg`);
  writeFileSync(out, buildGraphic(kit, cells, layout));
  console.log(`${out}: ${layout.cells.length} cells`);
}

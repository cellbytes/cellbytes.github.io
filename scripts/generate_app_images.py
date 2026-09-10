# /// script
# requires-python = ">=3.12"
# dependencies = [
#     "playwright==1.62.0",
#     "pillow",
#     "numpy",
# ]
# ///
"""
Regenerates the /application page's feature-scroller screenshots.

Needs a running dev environment of the `cellbytes/app` repo; point DEV_URL at
its ingress (the devcontainer forwards it to $EXPOSED_PORT). Run from the repo
root so the output paths resolve:

    DEV_URL=http://localhost:3001 DEMO_PASSWORD=... \
        uv run --script scripts/generate_app_images.py

The sample-list frames come from the public demo instead, whose samples are
named after the diagnoses they show; the dev fixture's are not. DEMO_PASSWORD
is the demo account's, and DEMO_URL / DEMO_EMAIL only need setting to shoot the
list somewhere else.

Every other frame comes from SLIDE, a bone marrow slide of SAMPLE, and the
whole-slide frames share one viewport so the scroller crossfades between them
without the slide jumping. Frames that narrate one surface of a screen already
captured (the triage column, the whole-slide summary, the differential) are not
shot again: `highlight` dims a copy of that frame down to the boxes worth
reading, and those boxes are measured from the live elements rather than
written down as pixel coordinates, so a layout change carries them along.

The run reads the app and leaves it as it found it. That is what keeps it
repeatable, and it is why the report frame stops at the slide picker rather
than pressing Finish, which would write an evaluation and archive the sample.

The slide-dependent constants (CELL_*, the viewport values) were picked against
the dev fixture data: CELL_ID_DYSPLASIA is the vacuolated blast with the most
neighbouring cells, and the viewport centres the scanned tissue. Reading them
off a different slide means picking them again.
"""

import os
import re
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from playwright.sync_api import Locator, Page, expect, sync_playwright

URL = os.environ.get("DEV_URL", "http://localhost:3000")
CREDS = {"email": "test@mail.com", "password": "Testpass123!"}
DEMO_URL = os.environ.get("DEMO_URL", "https://demo.cellbytes.io")
DEMO_EMAIL = os.environ.get("DEMO_EMAIL", "celline-public@cellbytes.io")
# This repository is public, so the demo account's password is passed in rather
# than written down here, however freely the account itself is handed out.
DEMO_PASSWORD = os.environ.get("DEMO_PASSWORD")
SCROLLER = Path("src/assets/images/applicationScroller")

SAMPLE = 1
SLIDE = 2

DIMS = {"width": 1600, "height": 900}

# Viewport the whole-slide frames share: the scanned tissue, centred, filling
# the viewer. Written as OpenSeadragon search params, which the viewer reads on
# mount, so no frame has to be reached by panning.
WHOLE_SLIDE_VIEW = "x=0.515&y=0.205&z=1.8"
# Four of the slide's regions of interest, with room to the right of the
# rightmost one for its per-region popup, which is drawn outside the box.
REGIONS_VIEW = "x=0.46&y=0.205&z=3"
# A region of interest dense enough for individual cells to read at cell zoom.
ROI_VIEW = "x=0.5146&y=0.1609&z=200"
# The vacuolated blast the dysplasia frame selects, and the viewport holding it.
CELL_ID_DYSPLASIA = 10515
CELL_VIEW_DYSPLASIA = "x=0.5122&y=0.1678&z=369"
# How far the frame outside a highlight box is dimmed, and the corner radius
# the boxes are cut with.
DIM_FACTOR = 0.7
CORNER_RADIUS = 16
# Width of the inline cell panel. The default (300) fits one column of cell
# crops; this fits two, which is what makes the panel read as a gallery.
CELL_PANEL_WIDTH = 460


def rounded_mask(size: tuple[int, int], radius: int) -> Image.Image:
    """Alpha mask of a rounded rectangle filling `size`."""
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, size[0], size[1]], radius, fill=255)
    return mask


def dim(image: Image.Image, factor: float) -> Image.Image:
    """Copy of `image` with every pixel scaled towards black by `factor`."""
    scaled = np.asarray(image).astype(np.float32) * factor
    return Image.fromarray(np.clip(scaled, 0, 255).astype(np.uint8))


def highlight(
    source: Path,
    boxes: list[tuple[int, int, int, int]],
    out: Path | None = None,
) -> None:
    """Dims `source` except inside `boxes`, saving over it or to `out`."""
    base = Image.open(source).convert("RGB")
    result = dim(base, DIM_FACTOR)
    for box in boxes:
        clamped = (
            max(0, box[0]),
            max(0, box[1]),
            min(base.width, box[2]),
            min(base.height, box[3]),
        )
        region = base.crop(clamped)
        result.paste(region, clamped[:2], rounded_mask(region.size, CORNER_RADIUS))
    result.save(out or source)


def bounds(locator: Locator) -> tuple[float, float, float, float]:
    """One element's box as (x1, y1, x2, y2), waiting for it to be laid out."""
    locator.wait_for(state="visible")
    box = locator.bounding_box()
    if box is None:
        raise RuntimeError(f"element has no box: {locator}")
    return (box["x"], box["y"], box["x"] + box["width"], box["y"] + box["height"])


def span(*locators: Locator, pad: int = 10) -> tuple[int, int, int, int]:
    """Union of the locators' boxes, grown by `pad` on every side."""
    boxes = [bounds(locator) for locator in locators]
    return (
        round(min(b[0] for b in boxes) - pad),
        round(min(b[1] for b in boxes) - pad),
        round(max(b[2] for b in boxes) + pad),
        round(max(b[3] for b in boxes) + pad),
    )


def cross(columns: Locator, *rows: Locator, pad: int = 10) -> tuple[int, int, int, int]:
    """Box taking its horizontal extent from `columns` and its vertical from `rows`.

    A table column and a sidebar section are both cut this way: the element
    naming the region spans only one of the two axes.
    """
    x1, _, x2, _ = span(columns, pad=pad)
    _, y1, _, y2 = span(*rows, pad=pad)
    return (x1, y1, x2, y2)


def wait_for_slide(page: Page) -> None:
    """Waits until the viewer has painted: tiles, overlays and the navigator.

    `data-loaded` only promises the image opened, so the outstanding tile and
    annotation requests are waited on separately; without that the navigator
    thumbnail lands in the frame half drawn.
    """
    page.wait_for_selector("#openSeaDragon[data-loaded=true]", timeout=60_000)
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(3000)


def sidebar(page: Page) -> Locator:
    return page.get_by_role("region", name="Sidebar")


def tabs(page: Page) -> Locator:
    return sidebar(page).get_by_role("tablist")


def cell_panel(page: Page) -> Locator:
    """The inline panel of cell crops beside the viewer."""
    return page.get_by_role("list").filter(
        has=page.get_by_role("button", name="Select cell").first
    )


def toolbar_box(page: Page) -> tuple[int, int, int, int]:
    """The viewer's overlay toolbar strip.

    It holds the mask selector, whose button takes the name of the active mask
    rather than keeping a fixed one, so the strip is measured from the controls
    bracketing it instead.
    """
    return span(
        page.get_by_role("switch", name="Boxes").last,
        page.get_by_role("button", name="Options"),
    )


def flow_boxes(page: Page) -> list[tuple[int, int, int, int]]:
    """What an evaluation-flow frame highlights: the stepper and the step's help."""
    return [
        span(
            page.get_by_role("tab", name="Slide picker"),
            page.get_by_role("button", name="Confirm"),
        ),
        span(page.get_by_role("tooltip")),
    ]


if not DEMO_PASSWORD:
    raise SystemExit("set DEMO_PASSWORD to the public demo account's password")

with sync_playwright() as playwright:
    browser = playwright.chromium.launch()
    context = browser.new_context(viewport=DIMS)
    context.set_default_timeout(30_000)
    # In dev the server answers /api/healthz with no version while the client
    # carries one, so BaseLayout pops its "new version released" dialog part way
    # through the run and masks whatever is on screen.
    context.route("**/api/healthz", lambda route: route.fulfill(status=200, body="ok"))
    page = context.new_page()
    page.request.post(f"{URL}/api/auth/login", data=CREDS, timeout=10_000)
    page.request.post(
        f"{DEMO_URL}/api/auth/login",
        data={"email": DEMO_EMAIL, "password": DEMO_PASSWORD},
        timeout=20_000,
    )

    print("01 sample list, 02 triage")
    page.goto(f"{DEMO_URL}/samples")
    expect(page.get_by_role("heading", level=1)).to_contain_text("Samples")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1500)
    page.screenshot(path=SCROLLER / "01-base.png")
    highlight(
        SCROLLER / "01-base.png",
        [
            cross(
                page.get_by_role("columnheader", name="Triage"),
                page.get_by_role("grid"),
            )
        ],
        SCROLLER / "02-triage.png",
    )

    print("03 regions of interest step")
    page.goto(
        f"{URL}/samples/{SAMPLE}/evaluate?step=slideAreas&slideId={SLIDE}"
        f"&roi=blast&table=diff&view=viewer&{REGIONS_VIEW}"
    )
    wait_for_slide(page)
    page.screenshot(path=SCROLLER / "03-tutorialization-rois.png")
    highlight(SCROLLER / "03-tutorialization-rois.png", flow_boxes(page))

    print("04 cell differential step")
    page.goto(
        f"{URL}/samples/{SAMPLE}/evaluate?step=differentialValidation"
        f"&slideId={SLIDE}&table=diff&view=gallery"
    )
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(4000)
    page.screenshot(path=SCROLLER / "04-tutorialization-cells.png")
    highlight(SCROLLER / "04-tutorialization-cells.png", flow_boxes(page))

    print("05 slide viewer, 06 whole slide summary, 08 differential")
    page.goto(f"{URL}/slides/{SLIDE}?{WHOLE_SLIDE_VIEW}")
    wait_for_slide(page)
    page.screenshot(path=SCROLLER / "05-slide-viewer.png")
    highlight(
        SCROLLER / "05-slide-viewer.png",
        [
            cross(
                sidebar(page),
                page.get_by_role("heading", level=1),
                page.get_by_text("Megakaryocytes:"),
            )
        ],
        SCROLLER / "06-scarcity-cellularity.png",
    )
    highlight(
        SCROLLER / "05-slide-viewer.png",
        [cross(sidebar(page), tabs(page), page.get_by_role("table", name="Cell differential"))],
        SCROLLER / "08-cell-differential.png",
    )

    print("07 mask overlay")
    page.goto(f"{URL}/slides/{SLIDE}?mask=center_mask&{WHOLE_SLIDE_VIEW}")
    wait_for_slide(page)
    page.screenshot(path=SCROLLER / "07-mask-visualization.png")
    highlight(
        SCROLLER / "07-mask-visualization.png",
        [span(page.locator("#openSeaDragon")), toolbar_box(page)],
    )

    print("09 differential per region")
    page.goto(f"{URL}/slides/{SLIDE}?{WHOLE_SLIDE_VIEW}")
    wait_for_slide(page)
    page.get_by_role("button", name="Diff per ROI").click()
    expect(page.get_by_role("dialog")).to_be_visible()
    page.wait_for_timeout(2500)
    page.screenshot(path=SCROLLER / "09-full-differential.png")

    print("10 cell gallery")
    page.goto(
        f"{URL}/slides/{SLIDE}?cells=bm_blast&cells-width={CELL_PANEL_WIDTH}&{ROI_VIEW}"
    )
    wait_for_slide(page)
    page.screenshot(path=SCROLLER / "10-cell-list.png")
    highlight(
        SCROLLER / "10-cell-list.png",
        [
            cross(sidebar(page), tabs(page), page.get_by_role("table", name="Cell differential")),
            span(cell_panel(page)),
        ],
    )

    print("11 cell clusters")
    page.goto(f"{URL}/slides/{SLIDE}?table=clusters&{WHOLE_SLIDE_VIEW}")
    wait_for_slide(page)
    clusters = page.get_by_role("table", name="Clusters")
    expect(clusters).to_be_visible()
    # A cluster spans a few hundred image pixels, which is a marker a couple of
    # pixels wide at whole-slide zoom, so the frame shows the pile itself:
    # clicking the largest cluster's row zooms the viewer onto it and
    # highlights its cells. The row only takes its selected styling once the
    # viewer has actually navigated, which is the signal to wait on.
    # Labels are off by default; turning them on names the class of every cell
    # the pile is made of, which is the claim the frame is there to make.
    page.get_by_role("switch", name="Labels").click()
    row = clusters.get_by_role("rowgroup").last.get_by_role("row").first
    row.click()
    expect(row).to_have_class(re.compile(r"\bselected\b"))
    wait_for_slide(page)
    page.screenshot(path=SCROLLER / "11-cell-clusters.png")
    highlight(
        SCROLLER / "11-cell-clusters.png",
        [
            cross(sidebar(page), tabs(page), page.get_by_role("table", name="Clusters")),
            span(page.locator("#openSeaDragon")),
        ],
    )

    print("12 dysplasia")
    page.goto(
        f"{URL}/slides/{SLIDE}?table=dysplasia"
        f"&dysplasia=blasts_immature_granulocytes-vacuolated"
        f"&cell-id={CELL_ID_DYSPLASIA}&cells-width={CELL_PANEL_WIDTH}&{CELL_VIEW_DYSPLASIA}"
    )
    wait_for_slide(page)
    page.screenshot(path=SCROLLER / "12-dysplasias.png")
    highlight(
        SCROLLER / "12-dysplasias.png",
        [
            cross(sidebar(page), tabs(page), page.get_by_role("table", name="Dysplasia")),
            span(cell_panel(page)),
        ],
    )

    print("13 sample report")
    # The report step builds its document from the slides ticked in the picker,
    # so ticking one renders it without confirming any step. Finishing the
    # sample is what writes an evaluation and moves it to the archive, so the
    # run stops short of that button.
    page.goto(f"{URL}/samples/{SAMPLE}/evaluate?step=report")
    page.wait_for_load_state("networkidle")
    page.get_by_role("checkbox").first.check()
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(5000)
    page.screenshot(path=SCROLLER / "13-report.png")

    browser.close()

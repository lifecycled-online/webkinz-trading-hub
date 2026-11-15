from pathlib import Path

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.dml import MSO_LINE_DASH_STYLE
from pptx.enum.shapes import MSO_CONNECTOR, MSO_SHAPE
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.util import Inches, Pt


ROOT = Path(__file__).resolve().parent
OUTPUT = ROOT / "Webkinz-Trading-Hub.pptx"

SW, SH = 13.333, 7.5
BG = "FFF9F4"
PAPER = "FFFEFC"
INK = "553E3A"
MUTED = "806D69"
PINK = "F8DCE2"
PINK_LINE = "D991A1"
BLUE = "DCEEFA"
BLUE_LINE = "7BAAC8"
YELLOW = "FFF0C7"
YELLOW_LINE = "C6A45A"
GREEN = "DDEDE3"
GREEN_LINE = "79A487"
LAVENDER = "E9E1F3"
LAVENDER_LINE = "A894C3"


def rgb(value):
    return RGBColor.from_string(value)


def shape(slide, kind, x, y, w, h, fill, outline=None, dash=False, rotation=0):
    result = slide.shapes.add_shape(
        kind, Inches(x), Inches(y), Inches(w), Inches(h)
    )
    result.rotation = rotation
    result.fill.solid()
    result.fill.fore_color.rgb = rgb(fill)
    if outline:
        result.line.color.rgb = rgb(outline)
        result.line.width = Pt(1.25)
        if dash:
            result.line.dash_style = MSO_LINE_DASH_STYLE.DASH
    else:
        result.line.fill.background()
    return result


def text(
    slide,
    value,
    x,
    y,
    w,
    h,
    size=16,
    color=INK,
    bold=False,
    font="Aptos",
    align=PP_ALIGN.LEFT,
    valign=MSO_ANCHOR.TOP,
    margin=0,
    italic=False,
):
    box = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    frame = box.text_frame
    frame.clear()
    frame.word_wrap = True
    frame.margin_left = Inches(margin)
    frame.margin_right = Inches(margin)
    frame.margin_top = Inches(margin)
    frame.margin_bottom = Inches(margin)
    frame.vertical_anchor = valign
    paragraph = frame.paragraphs[0]
    paragraph.alignment = align
    paragraph.space_after = Pt(0)
    paragraph.space_before = Pt(0)
    run = paragraph.add_run()
    run.text = value
    run.font.name = font
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.italic = italic
    run.font.color.rgb = rgb(color)
    return box


def linked_text(slide, label, url, x, y, w, h, size=11):
    box = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    frame = box.text_frame
    frame.clear()
    frame.word_wrap = True
    frame.margin_left = Inches(0)
    frame.margin_right = Inches(0)
    frame.margin_top = Inches(0)
    frame.margin_bottom = Inches(0)
    paragraph = frame.paragraphs[0]
    run = paragraph.add_run()
    run.text = label
    run.font.name = "Aptos"
    run.font.size = Pt(size)
    run.font.color.rgb = rgb(BLUE_LINE)
    run.font.underline = True
    run.hyperlink.address = url
    return box


def add_paw(slide, x, y, scale=1):
    paw = [
        (0.03, 0.31, 0.20, 0.24, BLUE, -22),
        (0.26, 0.06, 0.19, 0.25, YELLOW, -7),
        (0.52, 0.06, 0.19, 0.25, PINK, 7),
        (0.75, 0.31, 0.20, 0.24, BLUE, 22),
    ]
    for dx, dy, w, h, fill, angle in paw:
        shape(
            slide,
            MSO_SHAPE.OVAL,
            x + dx * scale,
            y + dy * scale,
            w * scale,
            h * scale,
            fill,
            rotation=angle,
        )
    shape(
        slide,
        MSO_SHAPE.HEART,
        x + 0.17 * scale,
        y + 0.42 * scale,
        0.64 * scale,
        0.56 * scale,
        PINK,
        rotation=180,
    )


def sparkle(slide, x, y, size=0.11, color=YELLOW_LINE):
    shape(slide, MSO_SHAPE.DIAMOND, x, y, size, size, color)


def quilt_background(slide, accent=True):
    slide.background.fill.solid()
    slide.background.fill.fore_color.rgb = rgb(BG)
    if accent:
        shape(slide, MSO_SHAPE.ROUNDED_RECTANGLE, 11.84, 0.40, 0.92, 0.40, BLUE, BLUE_LINE, True)
        shape(slide, MSO_SHAPE.ROUNDED_RECTANGLE, 11.98, 0.93, 0.92, 0.40, YELLOW, YELLOW_LINE, True)
        shape(slide, MSO_SHAPE.ROUNDED_RECTANGLE, 11.70, 1.46, 0.92, 0.40, PINK, PINK_LINE, True)


def footer(slide, number):
    line = slide.shapes.add_connector(
        MSO_CONNECTOR.STRAIGHT, Inches(0.58), Inches(7.08), Inches(12.75), Inches(7.08)
    )
    line.line.color.rgb = rgb("E9D9D3")
    line.line.width = Pt(0.8)
    text(slide, "WEBKINZ TRADING HUB  /  PROJECT STORY", 0.62, 7.12, 4.5, 0.2, 8.5, MUTED, bold=True)
    text(slide, f"{number:02d}", 12.15, 7.11, 0.55, 0.2, 9, MUTED, bold=True, align=PP_ALIGN.RIGHT)


def heading(slide, label, title, subtitle=None, number=None):
    quilt_background(slide)
    shape(slide, MSO_SHAPE.ROUNDED_RECTANGLE, 0.62, 0.42, 2.35, 0.36, PINK, PINK_LINE, True)
    text(slide, label.upper(), 0.78, 0.48, 2.05, 0.2, 9, INK, bold=True, valign=MSO_ANCHOR.MIDDLE)
    text(slide, title, 0.62, 0.92, 11.2, 0.70, 30, INK, bold=True, font="Aptos Display")
    if subtitle:
        text(slide, subtitle, 0.66, 1.63, 10.7, 0.42, 13, MUTED)
    if number is not None:
        footer(slide, number)


def card(slide, x, y, w, h, fill, border, title, body=None, title_size=19, body_size=13):
    shape(slide, MSO_SHAPE.ROUNDED_RECTANGLE, x, y, w, h, fill, border, True)
    text(slide, title, x + 0.22, y + 0.20, w - 0.44, 0.48, title_size, INK, bold=True, font="Aptos Display")
    if body:
        text(slide, body, x + 0.22, y + 0.78, w - 0.44, h - 0.94, body_size, INK)


def pill(slide, label, x, y, w, fill, border, size=10):
    shape(slide, MSO_SHAPE.ROUNDED_RECTANGLE, x, y, w, 0.36, fill, border, True)
    text(slide, label, x + 0.08, y + 0.06, w - 0.16, 0.20, size, INK, bold=True, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE)


def connector(slide, x1, y1, x2, y2, color=PINK_LINE, width=2):
    line = slide.shapes.add_connector(
        MSO_CONNECTOR.STRAIGHT, Inches(x1), Inches(y1), Inches(x2), Inches(y2)
    )
    line.line.color.rgb = rgb(color)
    line.line.width = Pt(width)
    line.line.end_arrowhead = True
    return line


def slide_cover(prs):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    quilt_background(slide, accent=False)
    shape(slide, MSO_SHAPE.ROUNDED_RECTANGLE, 8.86, 0.72, 3.60, 2.20, BLUE, BLUE_LINE, True)
    shape(slide, MSO_SHAPE.ROUNDED_RECTANGLE, 9.32, 3.20, 2.82, 1.90, YELLOW, YELLOW_LINE, True)
    shape(slide, MSO_SHAPE.ROUNDED_RECTANGLE, 8.30, 5.18, 3.70, 1.18, PINK, PINK_LINE, True)
    add_paw(slide, 9.78, 1.12, 1.85)
    sparkle(slide, 11.90, 2.67, 0.15, PINK_LINE)
    sparkle(slide, 8.71, 3.04, 0.12, YELLOW_LINE)
    sparkle(slide, 11.86, 5.48, 0.13, BLUE_LINE)
    shape(slide, MSO_SHAPE.ROUNDED_RECTANGLE, 0.76, 0.74, 2.65, 0.42, PINK, PINK_LINE, True)
    text(slide, "A COZY TRADING ORGANIZER", 0.91, 0.83, 2.35, 0.20, 9, INK, bold=True, valign=MSO_ANCHOR.MIDDLE)
    text(slide, "Webkinz\nTrading Hub", 0.72, 1.53, 7.65, 2.15, 42, INK, bold=True, font="Aptos Display")
    text(slide, "Less spreadsheet. More play.", 0.80, 4.03, 6.8, 0.48, 22, PINK_LINE, bold=True, font="Aptos Display")
    text(slide, "A home for browsing tradeable items, organizing your lists, and finding the right trading partner.", 0.82, 4.73, 6.75, 0.88, 17, INK)
    text(slide, "A project built for the Webkinz Classic community", 0.82, 6.34, 6.6, 0.32, 12, MUTED, italic=True)
    text(slide, "PROJECT PITCH", 0.82, 6.84, 2.0, 0.22, 9, MUTED, bold=True)
    return slide


def slide_community(prs):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    heading(slide, "The community", "A game world that grew up with its players", "The joy of collecting is still here. The tools around trading have not kept up.", 2)
    card(slide, 0.72, 2.42, 5.55, 3.15, BLUE, BLUE_LINE, "The nostalgia is real", "For many players, Webkinz Classic is more than a game from childhood. It is a world they return to, decorate, and keep collecting in.", 21, 16)
    card(slide, 7.02, 2.42, 5.55, 3.15, PINK, PINK_LINE, "The community has aged with it", "Our project is inspired by adult longtime players—including women who grew up with Webkinz—and the care they bring to trading.", 21, 16)
    pill(slide, "TEAM / COMMUNITY OBSERVATION — NOT OFFICIAL DEMOGRAPHIC DATA", 2.24, 5.95, 8.87, YELLOW, YELLOW_LINE, 9)
    text(slide, "That lived experience is the starting point for the product—not a claim about every player.", 2.05, 6.47, 9.25, 0.30, 11, MUTED, italic=True, align=PP_ALIGN.CENTER)
    return slide


def slide_trade_basics(prs):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    heading(slide, "Trading 101", "The Hub plans the trade; Webkinz completes it", "Many players meet in the in-game Trading Room; the Hub helps make discovery and coordination less random.", 3)
    steps = [
        ("01", "Know what’s tradable", "Check whether an item is eligible for trade before making a plan.", BLUE, BLUE_LINE),
        ("02", "Agree on the swap", "Both players decide what they are offering and what they want in return.", YELLOW, YELLOW_LINE),
        ("03", "Finalize in game", "Use Webkinz’s trade flow to complete the item exchange.", PINK, PINK_LINE),
    ]
    xs = [0.76, 4.77, 8.78]
    for (number, title, body, fill, border), x in zip(steps, xs):
        card(slide, x, 2.50, 3.75, 2.70, fill, border, title, body, 21, 15)
        pill(slide, number, x + 0.23, 2.14, 0.62, PAPER, border, 10)
    connector(slide, 4.22, 3.84, 4.55, 3.84)
    connector(slide, 8.23, 3.84, 8.56, 3.84)
    shape(slide, MSO_SHAPE.ROUNDED_RECTANGLE, 1.30, 5.77, 10.70, 0.65, PAPER, PINK_LINE, True)
    text(slide, "The Hub never moves items between game accounts. It organizes lists, matches, offers, and confirmations.", 1.56, 5.94, 10.18, 0.30, 13, INK, bold=True, align=PP_ALIGN.CENTER)
    return slide


def slide_problem(prs):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    heading(slide, "The problem", "Today’s trade hunt is scattered across tools", "The project story we heard: traders do a lot of manual lookup and copy/paste before a trade can even begin.", 4)
    steps = [
        ("Wiki", "Find the item page", BLUE, BLUE_LINE),
        ("Verify", "Check if it can be traded", YELLOW, YELLOW_LINE),
        ("Docs", "Paste items into a manual list", PINK, PINK_LINE),
        ("Groups", "Post and search Facebook groups", LAVENDER, LAVENDER_LINE),
        ("Repeat", "Keep lists and conversations in sync", GREEN, GREEN_LINE),
    ]
    x0, width, gap = 0.66, 2.18, 0.38
    for i, (title, body, fill, border) in enumerate(steps):
        x = x0 + i * (width + gap)
        card(slide, x, 2.55, width, 2.52, fill, border, title, body, 18, 13)
        if i < len(steps) - 1:
            connector(slide, x + width + 0.05, 3.81, x + width + gap - 0.07, 3.81, MUTED, 1.5)
    text(slide, "The cost is friction: duplicate lists, slow discovery, and coordination that lives in many places.", 1.05, 5.63, 11.2, 0.55, 17, INK, bold=True, align=PP_ALIGN.CENTER)
    text(slide, "This workflow is community-described and can vary by trader or group.", 2.10, 6.28, 9.1, 0.28, 10, MUTED, italic=True, align=PP_ALIGN.CENTER)
    return slide


def slide_solution(prs):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    heading(slide, "The solution", "One organized path from “I want that” to “let’s trade”", "A searchable, tradeability-aware catalog connects personal lists to real conversations.", 5)
    steps = [
        ("Browse", "Search the catalog", BLUE, BLUE_LINE),
        ("Save", "Track have + want", YELLOW, YELLOW_LINE),
        ("Match", "Find reciprocal interest", PINK, PINK_LINE),
        ("Offer", "Send and review proposals", LAVENDER, LAVENDER_LINE),
        ("Complete", "Exchange in game; confirm here", GREEN, GREEN_LINE),
    ]
    x0, width, gap = 0.66, 2.18, 0.38
    for i, (title, body, fill, border) in enumerate(steps):
        x = x0 + i * (width + gap)
        card(slide, x, 2.55, width, 2.58, fill, border, title, body, 17, 13)
        if i < len(steps) - 1:
            connector(slide, x + width + 0.05, 3.84, x + width + gap - 0.07, 3.84, MUTED, 1.5)
    pill(slide, "THE GAME REMAINS THE SOURCE OF THE ITEM EXCHANGE", 3.26, 5.77, 6.85, PAPER, GREEN_LINE, 10)
    return slide


def slide_features(prs):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    heading(slide, "What’s built", "A toolkit for the full trading journey", "From discovery through the final in-game exchange, each step has a clear place.", 6)
    cards = [
        (0.70, 2.34, 3.78, 1.67, BLUE, BLUE_LINE, "Browse", "Explore categories or search item names; focus on items flagged tradeable."),
        (4.78, 2.34, 3.78, 1.67, YELLOW, YELLOW_LINE, "Inventory + wishlist", "Keep separate lists of what you have and what you hope to find."),
        (8.86, 2.34, 3.78, 1.67, PINK, PINK_LINE, "Reciprocal matches", "Surface traders whose inventories and wishlists line up."),
        (2.74, 4.38, 3.78, 1.67, LAVENDER, LAVENDER_LINE, "Offers", "Send, receive, accept, decline, or withdraw a proposal."),
        (6.82, 4.38, 3.78, 1.67, GREEN, GREEN_LINE, "Safer follow-through", "Contact is shared after acceptance; both traders can confirm completion."),
    ]
    for x, y, w, h, fill, border, title, body in cards:
        card(slide, x, y, w, h, fill, border, title, body, 18, 12.5)
    return slide


def slide_catalog(prs):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    heading(slide, "Catalog scale", "A big collection, made easier to navigate", "Counts below are measured from the current repository snapshot—not the full game universe.", 7)
    stats = [
        ("6,681", "unique item IDs", BLUE, BLUE_LINE),
        ("4,583", "unique IDs flagged tradeable", YELLOW, YELLOW_LINE),
        ("133", "item data files", PINK, PINK_LINE),
    ]
    xs = [0.85, 4.79, 8.73]
    for (number, label, fill, border), x in zip(stats, xs):
        shape(slide, MSO_SHAPE.ROUNDED_RECTANGLE, x, 2.55, 3.75, 2.05, fill, border, True)
        text(slide, number, x + 0.20, 2.86, 3.35, 0.82, 35, INK, bold=True, font="Aptos Display", align=PP_ALIGN.CENTER)
        text(slide, label, x + 0.24, 3.84, 3.27, 0.40, 13, INK, bold=True, align=PP_ALIGN.CENTER)
    text(slide, "The project story references an estimated 11,000+ items across Webkinz. That is a broader catalog estimate—not the current indexed count.", 1.12, 5.27, 11.06, 0.75, 14, INK, align=PP_ALIGN.CENTER)
    pill(slide, "CURRENT SNAPSHOT: 6,681 DISTINCT IDS  •  COUNTS CAN CHANGE AS DATA IS UPDATED", 1.77, 6.20, 9.80, PAPER, BLUE_LINE, 9)
    return slide


def slide_demo(prs):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    heading(slide, "Demo story", "A 30-second walkthrough judges can follow", "A single collector goes from a wanted item to an organized, mutually confirmed trade.", 8)
    demo_steps = [
        ("1", "Search", "Find a tradeable item in Browse."),
        ("2", "Save", "Add it to the wishlist; add owned items to Inventory."),
        ("3", "Match", "See a trader whose inventory and wishlist complement yours."),
        ("4", "Offer", "Propose a trade; accept or decline; contact becomes visible after acceptance."),
        ("5", "Finish", "Meet in Webkinz to exchange items, then both confirm in the Hub."),
    ]
    y = 2.28
    for i, (n, title, body) in enumerate(demo_steps):
        fill, border = [(BLUE, BLUE_LINE), (YELLOW, YELLOW_LINE), (PINK, PINK_LINE), (LAVENDER, LAVENDER_LINE), (GREEN, GREEN_LINE)][i]
        shape(slide, MSO_SHAPE.OVAL, 0.89, y + 0.05, 0.44, 0.44, fill, border)
        text(slide, n, 0.89, y + 0.14, 0.44, 0.20, 11, INK, bold=True, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE)
        text(slide, title, 1.56, y, 1.30, 0.34, 15, INK, bold=True)
        text(slide, body, 2.92, y, 6.54, 0.48, 13, INK)
        if i < len(demo_steps) - 1:
            connector(slide, 1.11, y + 0.53, 1.11, y + 0.81, "D8C8C2", 1.2)
        y += 0.83
    shape(slide, MSO_SHAPE.ROUNDED_RECTANGLE, 10.02, 2.43, 2.52, 3.72, PAPER, PINK_LINE, True)
    text(slide, "THE HUB", 10.28, 2.76, 2.00, 0.30, 12, PINK_LINE, bold=True, align=PP_ALIGN.CENTER)
    for label, y, fill, border in [
        ("Browse", 3.29, BLUE, BLUE_LINE),
        ("Inventory", 3.90, YELLOW, YELLOW_LINE),
        ("Wishlist", 4.51, PINK, PINK_LINE),
        ("Matches + offers", 5.12, LAVENDER, LAVENDER_LINE),
    ]:
        pill(slide, label, 10.31, y, 1.94, fill, border, 10)
    return slide


def slide_tech(prs):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    heading(slide, "Under the hood", "A small, focused stack—built around a local catalog", "The browser handles discovery; authenticated user data and offers live behind an API.", 9)
    card(slide, 0.78, 2.35, 3.40, 1.25, BLUE, BLUE_LINE, "Web client", "Vanilla HTML, CSS, ES modules", 18, 12)
    card(slide, 4.96, 2.35, 3.40, 1.25, YELLOW, YELLOW_LINE, "API", "Node.js built-in HTTP server", 18, 12)
    card(slide, 9.12, 2.35, 3.40, 1.25, PINK, PINK_LINE, "Storage", "PostgreSQL via pg", 18, 12)
    connector(slide, 4.26, 2.98, 4.82, 2.98, BLUE_LINE)
    connector(slide, 8.44, 2.98, 8.98, 2.98, YELLOW_LINE)
    text(slide, "Tradeable catalog", 1.39, 3.88, 2.20, 0.30, 11, MUTED, bold=True, align=PP_ALIGN.CENTER)
    text(slide, "JSON files served with the frontend", 0.93, 4.23, 3.12, 0.56, 12, INK, align=PP_ALIGN.CENTER)
    text(slide, "Identity", 5.56, 3.88, 2.20, 0.30, 11, MUTED, bold=True, align=PP_ALIGN.CENTER)
    text(slide, "OpenID Connect via oidc-client-ts; API checks bearer tokens", 5.02, 4.23, 3.28, 0.56, 12, INK, align=PP_ALIGN.CENTER)
    text(slide, "Saved data", 9.73, 3.88, 2.20, 0.30, 11, MUTED, bold=True, align=PP_ALIGN.CENTER)
    text(slide, "Inventory, wishlist, and trade offers", 9.35, 4.23, 2.94, 0.56, 12, INK, align=PP_ALIGN.CENTER)
    shape(slide, MSO_SHAPE.ROUNDED_RECTANGLE, 0.82, 5.11, 11.70, 1.22, PAPER, GREEN_LINE, True)
    text(slide, "RUN LOCALLY", 1.08, 5.34, 1.50, 0.24, 10, GREEN_LINE, bold=True)
    text(slide, "npm install   →   npm run start:frontend   →   http://127.0.0.1:3001", 2.72, 5.27, 9.20, 0.36, 14, INK, bold=True)
    text(slide, "For accounts and offers: configure backend/.env, apply migrations 002 then 003, and run npm run start:backend. Never include secret values in a deck.", 1.08, 5.79, 11.10, 0.38, 10.5, MUTED)
    return slide


def slide_checklist(prs):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    heading(slide, "Devpost last mile", "The story is ready. Make the submission judge-ready.", "Keep the pitch focused on the user problem, the implemented workflow, and what is still outside the app.", 10)
    card(slide, 0.80, 2.30, 5.72, 3.74, GREEN, GREEN_LINE, "In the deck", "", 20, 12)
    card(slide, 6.80, 2.30, 5.72, 3.74, YELLOW, YELLOW_LINE, "Before submitting", "", 20, 12)
    left = [
        "Project title + clear tagline",
        "Problem, solution, and community story",
        "Actual stack and local setup steps",
        "Repository link and honest catalog scope",
    ]
    right = [
        "Add final team members + prize tracks",
        "Record a short demo video",
        "Capture real screenshots of key pages",
        "Verify live demo URL and sign-in flow",
        "Complete the final Devpost submission",
    ]
    for i, item in enumerate(left):
        y = 3.20 + i * 0.58
        shape(slide, MSO_SHAPE.OVAL, 1.12, y + 0.04, 0.20, 0.20, PAPER, GREEN_LINE)
        text(slide, "✓", 1.12, y + 0.025, 0.20, 0.20, 10, GREEN_LINE, bold=True, align=PP_ALIGN.CENTER)
        text(slide, item, 1.47, y, 4.65, 0.34, 12.5, INK)
    for i, item in enumerate(right):
        y = 3.10 + i * 0.52
        shape(slide, MSO_SHAPE.OVAL, 7.12, y + 0.04, 0.20, 0.20, PAPER, YELLOW_LINE)
        text(slide, "□", 7.11, y + 0.015, 0.22, 0.22, 11, YELLOW_LINE, bold=True, align=PP_ALIGN.CENTER)
        text(slide, item, 7.47, y, 4.58, 0.34, 12.5, INK)
    linked_text(slide, "github.com/lifecycled-online/webkinz-trading-hub", "https://github.com/lifecycled-online/webkinz-trading-hub", 2.73, 6.40, 7.95, 0.25, 11)
    return slide


def slide_close(prs):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    quilt_background(slide, accent=False)
    shape(slide, MSO_SHAPE.ROUNDED_RECTANGLE, 0.78, 0.73, 11.78, 4.10, BLUE, BLUE_LINE, True)
    shape(slide, MSO_SHAPE.ROUNDED_RECTANGLE, 1.20, 5.18, 5.10, 0.92, YELLOW, YELLOW_LINE, True)
    shape(slide, MSO_SHAPE.ROUNDED_RECTANGLE, 6.54, 5.18, 5.18, 0.92, PINK, PINK_LINE, True)
    add_paw(slide, 5.95, 1.30, 1.35)
    sparkle(slide, 3.05, 2.06, 0.15, PINK_LINE)
    sparkle(slide, 9.25, 3.94, 0.12, YELLOW_LINE)
    text(slide, "Let collecting be the fun part.", 1.28, 2.12, 10.65, 0.75, 31, INK, bold=True, font="Aptos Display", align=PP_ALIGN.CENTER)
    text(slide, "Webkinz Trading Hub", 2.85, 3.23, 7.60, 0.40, 18, INK, bold=True, align=PP_ALIGN.CENTER)
    linked_text(slide, "Project repository", "https://github.com/lifecycled-online/webkinz-trading-hub", 2.00, 5.49, 3.10, 0.25, 11)
    linked_text(slide, "Webkinz official site", "https://www.webkinz.com/", 7.31, 5.49, 2.40, 0.25, 11)
    linked_text(slide, "Webkinz Guide catalog", "https://webkinzguide.com/wiki/Main_Page", 7.31, 5.77, 3.00, 0.24, 10.5)
    text(slide, "Catalog counts are from this repository snapshot. Demographic and 11,000+ catalog context are team-provided estimates, not official statistics.", 1.30, 6.42, 10.73, 0.32, 9.5, MUTED, align=PP_ALIGN.CENTER)
    text(slide, "THANK YOU", 5.55, 6.92, 2.20, 0.20, 9, MUTED, bold=True, align=PP_ALIGN.CENTER)
    return slide


def main():
    prs = Presentation()
    prs.slide_width = Inches(SW)
    prs.slide_height = Inches(SH)
    prs.core_properties.title = "Webkinz Trading Hub"
    prs.core_properties.subject = "Project pitch and Devpost submission presentation"
    prs.core_properties.author = "Webkinz Trading Hub team"
    prs.core_properties.keywords = "Webkinz, trading, project pitch"

    slides = [
        slide_cover,
        slide_community,
        slide_trade_basics,
        slide_problem,
        slide_solution,
        slide_features,
        slide_catalog,
        slide_demo,
        slide_tech,
        slide_checklist,
        slide_close,
    ]
    for build_slide in slides:
        build_slide(prs)
    prs.save(OUTPUT)
    print(f"Created {OUTPUT} ({len(prs.slides)} slides)")


if __name__ == "__main__":
    main()

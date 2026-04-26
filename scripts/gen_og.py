#!/usr/bin/env python3
"""
Generate per-post and per-topic Open Graph images for Applied Craft.

Reads posts/posts.json + the topic list, emits 1200x630 PNGs to /og/.
Layout: wordmark top-left, title (serif) centered-vertically with wrap,
date+read-time bottom-left, small accent dot bottom-right.

Usage:
    python3 scripts/gen_og.py [--sample slug]

    --sample <slug>   render only one image (the post with that slug,
                      or the topic 'topic-<slug>') for visual review
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
FONTS_DIR = ROOT / "scripts" / "fonts"
OG_DIR = ROOT / "og"
POSTS_JSON = ROOT / "posts" / "posts.json"

WIDTH, HEIGHT = 1200, 630

# Colours sampled from the light theme of the blog. Light is canonical
# for OG cards because most preview-card renderers show on a white-ish
# chrome regardless of the user's OS theme.
BG = (250, 249, 247)            # --color-bg
TEXT = (28, 25, 23)             # --color-text
SECONDARY = (87, 83, 78)        # --color-text-secondary
TERTIARY = (168, 162, 158)      # --color-text-tertiary
ACCENT = (180, 83, 9)           # --color-accent
RULE = (231, 229, 228)          # --color-border

PADDING = 80
WORDMARK_Y = 70
TITLE_TOP = 200
SUBTITLE_BOTTOM = HEIGHT - 100
ACCENT_R = 8

TOPICS = [
    {"slug": "taste",              "name": "Taste",              "lede": "The evaluative half of how good work happens."},
    {"slug": "creativity",         "name": "Creativity",         "lede": "The generative half. Three things, all trainable."},
    {"slug": "intuition",          "name": "Intuition",          "lede": "A different kind of knowing."},
    {"slug": "judgment",           "name": "Judgment",           "lede": "The master variable in the AI era."},
    {"slug": "product-management", "name": "Product Management", "lede": "What the craft is in the AI era."},
]


def load_fonts():
    """Load variable fonts at the specific weights/sizes we need."""
    inter_path = FONTS_DIR / "Inter.ttf"
    news_path = FONTS_DIR / "Newsreader.ttf"

    fonts = {
        "wm_applied":  ImageFont.truetype(str(inter_path), 22),
        "wm_craft":    ImageFont.truetype(str(inter_path), 22),
        "title_lg":    ImageFont.truetype(str(news_path), 72),
        "title_md":    ImageFont.truetype(str(news_path), 60),
        "title_sm":    ImageFont.truetype(str(news_path), 50),
        "subtitle":    ImageFont.truetype(str(inter_path), 22),
    }
    # Set variable-font weight axes where possible
    try:
        fonts["wm_applied"].set_variation_by_axes([700, 14])  # weight, opsz
        fonts["wm_craft"].set_variation_by_axes([400, 14])
        fonts["title_lg"].set_variation_by_axes([400, 72])
        fonts["title_md"].set_variation_by_axes([400, 60])
        fonts["title_sm"].set_variation_by_axes([400, 50])
        fonts["subtitle"].set_variation_by_axes([400, 14])
    except (AttributeError, OSError):
        # older Pillow or non-variable fallback — fine, defaults are OK
        pass
    return fonts


def wrap_text(text: str, font: ImageFont.FreeTypeFont, max_width: int) -> list[str]:
    """Word-wrap text to fit max_width pixels."""
    words = text.split()
    lines: list[str] = []
    current: list[str] = []
    for word in words:
        candidate = " ".join(current + [word])
        if font.getlength(candidate) <= max_width or not current:
            current.append(word)
        else:
            lines.append(" ".join(current))
            current = [word]
    if current:
        lines.append(" ".join(current))
    return lines


def fit_title(title: str, fonts: dict, max_width: int):
    """Pick the largest title font that wraps to <= 4 lines."""
    for font_key in ("title_lg", "title_md", "title_sm"):
        font = fonts[font_key]
        lines = wrap_text(title, font, max_width)
        if len(lines) <= 4:
            return font, lines
    # Fallback: smallest font, hard-truncate to 4 lines
    font = fonts["title_sm"]
    lines = wrap_text(title, font, max_width)[:4]
    return font, lines


def line_height_for(font: ImageFont.FreeTypeFont) -> int:
    ascent, descent = font.getmetrics()
    return int((ascent + descent) * 1.15)


def format_date(iso: str) -> str:
    dt = datetime.strptime(iso, "%Y-%m-%d")
    # platform-portable day-without-leading-zero
    return dt.strftime("%B ") + str(dt.day) + dt.strftime(", %Y")


def draw_og(title: str, subtitle: str, output: Path, fonts: dict):
    img = Image.new("RGB", (WIDTH, HEIGHT), BG)
    draw = ImageDraw.Draw(img)

    # Wordmark: APPLIED (semi-bold) + CRAFT (regular), spaced apart
    applied = "APPLIED"
    craft = "CRAFT"
    draw.text((PADDING, WORDMARK_Y), applied, font=fonts["wm_applied"], fill=TEXT)
    applied_w = fonts["wm_applied"].getlength(applied)
    draw.text((PADDING + applied_w + 12, WORDMARK_Y), craft, font=fonts["wm_craft"], fill=TERTIARY)

    # Thin rule under the wordmark for visual structure
    rule_y = WORDMARK_Y + 44
    draw.line([(PADDING, rule_y), (PADDING + 80, rule_y)], fill=RULE, width=1)

    # Title — pick the size that fits
    max_title_w = WIDTH - 2 * PADDING
    title_font, lines = fit_title(title, fonts, max_title_w)
    lh = line_height_for(title_font)

    # Vertically center the title block in the middle band
    block_h = lh * len(lines)
    middle_top = TITLE_TOP
    middle_bottom = SUBTITLE_BOTTOM - 40
    middle_h = middle_bottom - middle_top
    y_start = middle_top + max(0, (middle_h - block_h) // 2)

    y = y_start
    for line in lines:
        draw.text((PADDING, y), line, font=title_font, fill=TEXT)
        y += lh

    # Subtitle (date · read-time, or "Topic")
    draw.text((PADDING, SUBTITLE_BOTTOM), subtitle, font=fonts["subtitle"], fill=SECONDARY)

    # Accent dot bottom-right
    cx = WIDTH - PADDING
    cy = SUBTITLE_BOTTOM + fonts["subtitle"].size // 2
    draw.ellipse(
        [cx - ACCENT_R, cy - ACCENT_R, cx + ACCENT_R, cy + ACCENT_R],
        fill=ACCENT,
    )

    OG_DIR.mkdir(exist_ok=True)
    img.save(output, "PNG", optimize=True)
    print(f"  wrote {output.relative_to(ROOT)}  ({len(lines)} title lines)")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--sample", help="Generate only one image (post slug or topic-<slug>)")
    args = parser.parse_args()

    fonts = load_fonts()

    posts = json.loads(POSTS_JSON.read_text())

    targets = []
    for post in posts:
        slug = post["slug"]
        subtitle = f"{format_date(post['date'])}  ·  {post['readTime']}"
        targets.append((post["title"], subtitle, OG_DIR / f"{slug}.png"))

    for topic in TOPICS:
        targets.append((topic["name"], "Topic  ·  Applied Craft", OG_DIR / f"topic-{topic['slug']}.png"))

    if args.sample:
        sample = args.sample
        filtered = [t for t in targets if t[2].stem == sample]
        if not filtered:
            print(f"no target with slug {sample!r}", file=sys.stderr)
            sys.exit(1)
        targets = filtered

    print(f"rendering {len(targets)} OG image(s)")
    for title, subtitle, out in targets:
        draw_og(title, subtitle, out, fonts)


if __name__ == "__main__":
    main()

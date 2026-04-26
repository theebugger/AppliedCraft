#!/usr/bin/env python3
"""
Update og:image / twitter:image / JSON-LD image URLs in each post and
topic HTML file so they point to the per-page PNG instead of the generic
site icon. Also corrects width/height (1200x630 vs the icon's 1024x1024).

Idempotent: running twice produces no further change.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
POSTS_DIR = ROOT / "posts"
TOPICS_DIR = ROOT / "topics"
POSTS_JSON = POSTS_DIR / "posts.json"

ICON_URL = "https://appliedcraft.blog/icon.png"
BASE = "https://appliedcraft.blog"


def rewrite(html: str, og_url: str, alt: str) -> tuple[str, int]:
    """Replace icon.png references with og_url and correct dimensions."""
    changed = 0

    def sub(pattern: str, replacement: str, content: str):
        nonlocal changed
        new, n = re.subn(pattern, replacement, content)
        changed += n
        return new

    # og:image content
    html = sub(
        rf'<meta property="og:image" content="{re.escape(ICON_URL)}">',
        f'<meta property="og:image" content="{og_url}">',
        html,
    )
    # twitter:image content
    html = sub(
        rf'<meta name="twitter:image" content="{re.escape(ICON_URL)}">',
        f'<meta name="twitter:image" content="{og_url}">',
        html,
    )
    # og:image dimensions (1024 -> 1200x630)
    html = sub(
        r'<meta property="og:image:width" content="1024">',
        '<meta property="og:image:width" content="1200">',
        html,
    )
    html = sub(
        r'<meta property="og:image:height" content="1024">',
        '<meta property="og:image:height" content="630">',
        html,
    )
    # JSON-LD "image":"...icon.png"
    html = sub(
        rf'"image":"{re.escape(ICON_URL)}"',
        f'"image":"{og_url}"',
        html,
    )

    return html, changed


def update_file(path: Path, og_path: str, alt: str) -> int:
    html = path.read_text()
    new_html, n = rewrite(html, f"{BASE}{og_path}", alt)
    if n:
        path.write_text(new_html)
    print(f"  {path.relative_to(ROOT)}  ({n} replacement{'s' if n != 1 else ''})")
    return n


def main():
    total = 0

    posts = json.loads(POSTS_JSON.read_text())
    print(f"updating {len(posts)} post HTMLs")
    for post in posts:
        slug = post["slug"]
        html_path = POSTS_DIR / f"{slug}.html"
        if not html_path.exists():
            print(f"  skip: {html_path} missing", file=sys.stderr)
            continue
        og_path = f"/og/{slug}.png"
        total += update_file(html_path, og_path, post["title"])

    topics = ["taste", "creativity", "intuition", "judgment", "product-management"]
    print(f"updating {len(topics)} topic HTMLs")
    for slug in topics:
        html_path = TOPICS_DIR / f"{slug}.html"
        if not html_path.exists():
            print(f"  skip: {html_path} missing", file=sys.stderr)
            continue
        og_path = f"/og/topic-{slug}.png"
        total += update_file(html_path, og_path, slug.replace("-", " ").title())

    print(f"done: {total} total replacements")


if __name__ == "__main__":
    main()

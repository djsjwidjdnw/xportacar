#!/usr/bin/env python3
"""Produce App Store-compliant 1024x1024 PNG icons.

Apple requires the marketing icon to be 1024x1024, PNG, RGB, with NO alpha
channel / transparency. The source Expo icons are palette PNGs that may carry
transparency, so we flatten them onto a solid background and strip alpha.

Usage:  python scripts/app-store/make-icons.py
Outputs: docs/app-store/buyer-icon-1024.png, docs/app-store/inspector-icon-1024.png
"""
import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PROJECTS = os.path.dirname(ROOT)
BRAND_BG = (21, 112, 239)  # #1570EF — used only if a corner pixel is transparent

SOURCES = [
    ("buyer-icon-1024.png", os.path.join(PROJECTS, "xportacar-mobile", "assets", "icon.png")),
    ("inspector-icon-1024.png", os.path.join(PROJECTS, "xportacar-inspection", "assets", "icon.png")),
]


def flatten(src_path: str, out_path: str) -> None:
    img = Image.open(src_path).convert("RGBA")
    # Choose a background: reuse the icon's own top-left pixel when it's opaque
    # (preserves the real backdrop); otherwise fall back to the brand colour.
    corner = img.getpixel((0, 0))
    bg = corner[:3] if len(corner) == 4 and corner[3] == 255 else BRAND_BG
    canvas = Image.new("RGB", img.size, bg)
    canvas.paste(img, mask=img.split()[3])  # composite using the alpha channel
    if canvas.size != (1024, 1024):
        canvas = canvas.resize((1024, 1024), Image.LANCZOS)
    # Save as RGB (no alpha). optimize keeps it small.
    canvas.save(out_path, "PNG", optimize=True)
    print(f"wrote {out_path}  ({canvas.size[0]}x{canvas.size[1]}, mode={canvas.mode}, bg={bg})")


def main() -> None:
    out_dir = os.path.join(ROOT, "docs", "app-store")
    os.makedirs(out_dir, exist_ok=True)
    for out_name, src in SOURCES:
        if not os.path.exists(src):
            print(f"SKIP {out_name}: source not found at {src}")
            continue
        flatten(src, os.path.join(out_dir, out_name))


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Generate 13" iPad App Store screenshots by reframing the 6.5" iPhone shots.

App Store Connect accepts a single iPad set at the 13" pixel dimensions
(2064x2752). We reuse the already-branded 6.5" iPhone marketing screenshots
(1284x2778) and center each on a solid light background that matches the app's
white theme, scaled down so there is subtle padding on all four sides.

  python scripts/screenshots/make-ipad.py

Input :  docs/app-store/screenshots/<app>/6.5/*.png
Output:  docs/app-store/screenshots/<app>/ipad-13/*.png   (2064x2752, RGB)
"""
import os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))            # repo root (…/xportacar)
SHOTS = os.path.join(ROOT, "docs", "app-store", "screenshots")

IPAD = (2064, 2752)          # 13" iPad portrait (App Store Connect)
BG = (255, 255, 255)         # app white theme (manifest background_color #ffffff)
PAD_FRAC = 0.06              # subtle padding (each side) as a fraction of the limiting dimension
APPS = ["buyer", "inspector"]


def reframe(src_path, dst_path):
    canvas = Image.new("RGB", IPAD, BG)
    shot = Image.open(src_path).convert("RGB")

    # Scale to fit inside the canvas with padding on every side.
    max_w = int(IPAD[0] * (1 - 2 * PAD_FRAC))
    max_h = int(IPAD[1] * (1 - 2 * PAD_FRAC))
    scale = min(max_w / shot.width, max_h / shot.height)
    new = (max(1, round(shot.width * scale)), max(1, round(shot.height * scale)))
    shot = shot.resize(new, Image.LANCZOS)

    x = (IPAD[0] - new[0]) // 2
    y = (IPAD[1] - new[1]) // 2
    canvas.paste(shot, (x, y))

    os.makedirs(os.path.dirname(dst_path), exist_ok=True)
    canvas.save(dst_path, "PNG")
    return new, (x, y)


def main():
    count = 0
    for app in APPS:
        src_dir = os.path.join(SHOTS, app, "6.5")
        dst_dir = os.path.join(SHOTS, app, "ipad-13")
        for f in sorted(os.listdir(src_dir)):
            if not f.lower().endswith(".png"):
                continue
            size, pos = reframe(os.path.join(src_dir, f), os.path.join(dst_dir, f))
            pad = (pos[0], pos[1], IPAD[0] - pos[0] - size[0], IPAD[1] - pos[1] - size[1])
            print(f"{app}/ipad-13/{f}: shot {size} at {pos}  pad(l,t,r,b)={pad}")
            count += 1
    print(f"Generated {count} iPad screenshots ({IPAD[0]}x{IPAD[1]}) under {SHOTS}")


if __name__ == "__main__":
    main()

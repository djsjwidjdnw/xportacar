#!/usr/bin/env python3
"""Generate professional App Store "marketing" screenshots.

Takes raw app screenshots and composites each onto a branded background inside a
phone frame, with a marketing headline on top. Outputs at the three required
App Store sizes. These convert far better than raw screenshots.

WORKFLOW
  1. Capture raw screenshots from the iOS app (see docs/app-store/screenshots.md)
     and drop them in scripts/screenshots/input/<app>/ (PNG or JPEG), named per
     the SHOTS map below:
       buyer/      1-browse.jpeg 2-bid-or-buy.jpeg 3-secure-wins.jpeg
       inspector/  1-dashboard.jpeg 2-assignments.jpeg 3-details.jpeg
                   4-photos.jpeg 5-submit.jpeg
  2. Run:  python scripts/screenshots/make-mockups.py
  3. Find framed images in docs/app-store/screenshots/<app>/<size>/

If a raw screenshot is missing, a clearly-labelled placeholder screen is drawn
so the pipeline still produces a complete set you can preview.
"""
import os
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))   # repo root (…/xportacar)
IN = os.path.join(HERE, "input")
OUT = os.path.join(ROOT, "docs", "app-store", "screenshots")

# App Store device sizes (portrait): folder name -> (width, height)
SIZES = {
    "6.7": (1290, 2796),   # iPhone 15/16 Pro Max          (REQUIRED)
    "6.5": (1284, 2778),   # iPhone 11 Pro Max / XS Max     (REQUIRED)
    "5.5": (1242, 2208),   # iPhone 8 Plus                  (REQUIRED)
}

BRAND = (21, 112, 239)      # #1570EF
BRAND_DARK = (11, 79, 192)  # darker brand
BEZEL = (16, 24, 57)        # #101828
WHITE = (255, 255, 255)

# app -> [(screenshot filename, marketing headline), ...]
SHOTS = {
    "buyer": [
        ("1-browse.jpeg",      "Browse Premium\nVehicles"),
        ("2-bid-or-buy.jpeg",  "Bid or Buy\nInstantly"),
        ("3-secure-wins.jpeg", "Secure Auction\nWins"),
    ],
    "inspector": [
        ("1-dashboard.jpeg",   "Inspector\nDashboard"),
        ("2-assignments.jpeg", "Manage Your\nAssignments"),
        ("3-details.jpeg",     "Capture Vehicle\nDetails"),
        ("4-photos.jpeg",      "Document\nEvery Angle"),
        ("5-submit.jpeg",      "Submit for\nListing"),
    ],
}


def load_font(size, bold=True):
    candidates = (
        ["arialbd.ttf", "Arial Bold.ttf", "segoeuib.ttf", "DejaVuSans-Bold.ttf"]
        if bold else
        ["arial.ttf", "segoeui.ttf", "DejaVuSans.ttf"]
    )
    paths = []
    for c in candidates:
        paths += [c, os.path.join("C:\\Windows\\Fonts", c),
                  os.path.join("/usr/share/fonts/truetype/dejavu", c)]
    for p in paths:
        try:
            return ImageFont.truetype(p, size)
        except Exception:
            continue
    return ImageFont.load_default()


def gradient(w, h, top, bottom):
    base = Image.new("RGB", (w, h), top)
    draw = ImageDraw.Draw(base)
    for y in range(h):
        t = y / max(1, h - 1)
        draw.line([(0, y), (w, y)], fill=tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3)))
    return base


def wrap(draw, text, font, max_w):
    lines = []
    for para in text.split("\n"):
        words, cur = para.split(" "), ""
        for word in words:
            test = (cur + " " + word).strip()
            if draw.textlength(test, font=font) <= max_w or not cur:
                cur = test
            else:
                lines.append(cur)
                cur = word
        lines.append(cur)
    return lines


def placeholder_screen(w, h, label):
    img = gradient(w, h, (240, 246, 255), (255, 255, 255))
    d = ImageDraw.Draw(img)
    f = load_font(int(h * 0.035), bold=True)
    fs = load_font(int(h * 0.022), bold=False)
    d.text((w / 2, h * 0.45), "XportACar", font=f, fill=BRAND, anchor="mm")
    d.text((w / 2, h * 0.52), f"[{label}]", font=fs, fill=(120, 130, 150), anchor="mm")
    d.text((w / 2, h * 0.56), "replace with real screenshot", font=load_font(int(h * 0.016), False), fill=(160, 168, 184), anchor="mm")
    return img


def build(app, filename, headline, size_name, size):
    w, h = size
    canvas = gradient(w, h, BRAND, BRAND_DARK)
    draw = ImageDraw.Draw(canvas)

    # Headline (top ~22%)
    hf = load_font(int(w * 0.072), bold=True)
    lines = wrap(draw, headline, hf, w * 0.84)
    line_h = int(w * 0.086)
    y = int(h * 0.06)
    for ln in lines:
        draw.text((w / 2, y), ln, font=hf, fill=WHITE, anchor="ma")
        y += line_h

    # Phone frame in the lower area
    frame_w = int(w * 0.78)
    frame_h = int(frame_w * 2.16)            # ~ iPhone aspect
    max_frame_h = int(h * 0.66)
    if frame_h > max_frame_h:
        frame_h = max_frame_h
        frame_w = int(frame_h / 2.16)
    fx = (w - frame_w) // 2
    fy = h - frame_h - int(h * 0.04)
    radius = int(frame_w * 0.13)

    # shadow + bezel
    draw.rounded_rectangle([fx + 10, fy + 14, fx + frame_w + 10, fy + frame_h + 14],
                           radius=radius, fill=(0, 0, 0))
    draw.rounded_rectangle([fx, fy, fx + frame_w, fy + frame_h], radius=radius, fill=BEZEL)

    # screen area
    pad = int(frame_w * 0.035)
    sx, sy = fx + pad, fy + pad
    sw, sh = frame_w - 2 * pad, frame_h - 2 * pad
    src = os.path.join(IN, app, filename)
    shot = Image.open(src).convert("RGB") if os.path.exists(src) else placeholder_screen(sw, sh, filename)
    shot = shot.resize((sw, sh), Image.LANCZOS)
    # rounded mask for the screen
    mask = Image.new("L", (sw, sh), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, sw, sh], radius=int(radius * 0.7), fill=255)
    canvas.paste(shot, (sx, sy), mask)

    out_dir = os.path.join(OUT, app, size_name)
    os.makedirs(out_dir, exist_ok=True)
    out = os.path.join(out_dir, os.path.splitext(filename)[0] + ".png")
    canvas.save(out, "PNG")
    return out


def main():
    count = 0
    for app, shots in SHOTS.items():
        for filename, headline in shots:
            for size_name, size in SIZES.items():
                build(app, filename, headline, size_name, size)
                count += 1
    print(f"Generated {count} mockups under {OUT}")
    print("Drop real screenshots in scripts/screenshots/input/<app>/ and re-run "
          "to replace the placeholders.")


if __name__ == "__main__":
    main()

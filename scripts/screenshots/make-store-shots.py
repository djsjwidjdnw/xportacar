#!/usr/bin/env python3
"""Frame raw captures of the REAL app UI into App Store screenshots (1.0.1+).

Raw captures come from capture-app-web.mjs (the apps' own code built for web and
rendered in Chrome device emulation at exact App Store pixel sizes). This script
adds the brand background + headline + device frame, in the same style as the
1.0 set, at the two sizes App Store Connect asks for:

  iphone65 -> 1284 x 2778  (6.5" iPhone, screenshot set APP_IPHONE_65)
  ipad13   -> 2064 x 2752  (13" iPad,    screenshot set APP_IPAD_PRO_3GEN_129)

usage: python make-store-shots.py <app> <rawDir> <outDir>
  rawDir contains iphone65/<name>.png and ipad13/<name>.png
  output: <outDir>/<iphone65|ipad13>/<n>-<name>.png  (PNG, RGB, no alpha)
"""
import os
import sys
from PIL import Image, ImageDraw, ImageFont

BRAND = (21, 112, 239)      # #1570EF
BRAND_DARK = (11, 79, 192)
BEZEL = (16, 24, 57)        # #101828
WHITE = (255, 255, 255)
SIZES = {"iphone65": (1284, 2778), "ipad13": (2064, 2752)}

# app -> ordered [(raw capture name, headline)]; headlines carry no auction/bid wording
SHOTS = {
    "inspector": [
        ("2-details", "Capture Vehicle\nDetails"),
        ("3-pricing", "Suggest an\nAsking Price"),
        ("4-photos", "Document\nEvery Angle"),
        ("5-damage", "Tag Damage\nPanel by Panel"),
        ("6-paint", "Record Paint\nThickness"),
    ],
    "buyer": [
        ("marketplace", "Inspected UAE Cars,\nFixed Prices"),
        ("vehicle", "One Clear Price,\nBuy Instantly"),
        ("report", "Full Inspection\nReport"),
        ("purchases", "Track Your\nPurchases"),
        ("invoice", "Clear Invoice,\nNo Surprises"),
    ],
}


def font(size):
    for name in ("arialbd.ttf", "Arial Bold.ttf", "segoeuib.ttf", "DejaVuSans-Bold.ttf"):
        for p in (name, os.path.join("C:\\Windows\\Fonts", name), os.path.join("/usr/share/fonts/truetype/dejavu", name)):
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                continue
    return ImageFont.load_default()


def gradient(w, h):
    img = Image.new("RGB", (w, h), BRAND)
    d = ImageDraw.Draw(img)
    for y in range(h):
        t = y / max(1, h - 1)
        d.line([(0, y), (w, y)], fill=tuple(int(BRAND[i] + (BRAND_DARK[i] - BRAND[i]) * t) for i in range(3)))
    return img


def build(raw_path, headline, device, out_path):
    w, h = SIZES[device]
    canvas = gradient(w, h)
    draw = ImageDraw.Draw(canvas)
    hf = font(int(w * (0.072 if device == "iphone65" else 0.056)))
    y = int(h * 0.05)
    for line in headline.split("\n"):
        draw.text((w / 2, y), line, font=hf, fill=WHITE, anchor="ma")
        y += int(hf.size * 1.2)

    shot = Image.open(raw_path).convert("RGB")
    aspect = shot.width / shot.height
    top = y + int(h * 0.035)
    max_h = h - top - int(h * 0.035)
    max_w = int(w * (0.80 if device == "iphone65" else 0.84))
    pad_frac = 0.035 if device == "iphone65" else 0.025
    # frame = screen + bezel padding on every side
    screen_h = int(max_h / (1 + 2 * pad_frac / aspect * aspect))
    screen_w = int(screen_h * aspect)
    if screen_w > max_w:
        screen_w = max_w
        screen_h = int(screen_w / aspect)
    pad = int(screen_w * pad_frac)
    fw, fh = screen_w + 2 * pad, screen_h + 2 * pad
    fx, fy = (w - fw) // 2, top
    radius = int(fw * (0.11 if device == "iphone65" else 0.045))
    draw.rounded_rectangle([fx + 10, fy + 14, fx + fw + 10, fy + fh + 14], radius=radius, fill=(0, 0, 0))
    draw.rounded_rectangle([fx, fy, fx + fw, fy + fh], radius=radius, fill=BEZEL)
    shot = shot.resize((screen_w, screen_h), Image.LANCZOS)
    mask = Image.new("L", (screen_w, screen_h), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, screen_w, screen_h], radius=int(radius * 0.72), fill=255)
    canvas.paste(shot, (fx + pad, fy + pad), mask)

    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    canvas.convert("RGB").save(out_path, "PNG")
    return out_path


def main():
    app, raw_dir, out_dir = sys.argv[1], sys.argv[2], sys.argv[3]
    made = 0
    for device in SIZES:
        for n, (name, headline) in enumerate(SHOTS[app], start=1):
            src = os.path.join(raw_dir, device, f"{name}.png")
            if not os.path.exists(src):
                print(f"missing raw capture: {src}")
                continue
            out = build(src, headline, device, os.path.join(out_dir, device, f"{n}-{name.split('-', 1)[-1]}.png"))
            im = Image.open(out)
            print(f"{out}  {im.size}  {im.mode}")
            made += 1
    print(f"made {made} screenshots")


if __name__ == "__main__":
    main()

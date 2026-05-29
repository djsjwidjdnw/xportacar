# App Store screenshots — tooling

Two scripts; isolated from the web app (own `package.json`, generated output is gitignored).

## 1) `make-mockups.py` — framed marketing screenshots (recommended)
Composites raw screenshots onto a branded background inside a phone frame with a
marketing headline, at all three required App Store sizes. Runs with Python +
Pillow (no browser needed).

```
# 1. Put raw screenshots here (from the iOS Simulator — see step 3 below):
#    scripts/screenshots/input/buyer/      marketplace.png vehicle.png auction.png bidding.png won.png
#    scripts/screenshots/input/inspector/  list.png photos.png damage.png paint.png review.png
# 2. Generate:
python scripts/screenshots/make-mockups.py
# 3. Output: scripts/screenshots/output/<app>/<size>/<screen>.png
```
Missing raw screenshots are replaced by labelled placeholders so the pipeline
always produces a full preview set.

## 2) `capture-web.mjs` — raw WEB captures (reference only)
Captures the responsive **web** buyer app at the three device sizes. These are
the web UI, **not** the native iOS app — use for the marketing site or quick
reference, not as the final App Store screenshots.

```
cd scripts/screenshots
npm install
npx playwright install chromium
BASE_URL=https://xportacar.vercel.app \
BUYER_EMAIL=buyer@xportacar.com BUYER_PASSWORD=Demo!1234 \
AUCTION_ID=22222222-0001-0000-0000-000000000999 \
npm run capture
# Output: scripts/screenshots/web-capture/<size>/
```
(Run the demo seed first — `supabase/seed_demo_porsche.sql` — so there's a live
auction to capture.)

## 3) Real iOS screenshots (required for the App Store)
The apps are React Native / Expo, so genuine App Store screenshots must come
from the **iOS Simulator** (or a device). Full step-by-step instructions —
which device, which screen, what state — are in
**`docs/app-store/screenshots.md`**. Capture those, drop them in `input/<app>/`,
then run `make-mockups.py` to frame them.

## Required sizes
| Display | Pixels | Example device |
|---|---|---|
| 6.7" | 1290 × 2796 | iPhone 15 Pro Max / 16 Pro Max |
| 6.5" | 1284 × 2778 | iPhone 11 Pro Max / XS Max (1242×2688 also accepted) |
| 5.5" | 1242 × 2208 | iPhone 8 Plus |

Apple recommends up to 10; provide at least 3–5 per app.
